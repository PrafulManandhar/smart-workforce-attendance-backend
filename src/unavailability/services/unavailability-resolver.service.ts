import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UnavailabilityRuleFrequency, UnavailabilityRuleStatus } from '@prisma/client';

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface ResolvedUnavailability {
  date: Date; // Date only (start of day in local timezone)
  windows: TimeWindow[]; // Blocked time windows for this date
}

/**
 * Service for expanding recurring unavailability rules into date occurrences
 * and applying exceptions to compute final blocked time windows.
 *
 * This service handles:
 * - Expanding weekly rules into specific date occurrences
 * - Applying timezone-aware local times
 * - Handling overnight windows
 * - Merging and subtracting windows cleanly
 * - Applying exceptions in order: REPLACE, REMOVE, ADD
 */
@Injectable()
export class UnavailabilityResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve unavailability for an employee within a date range.
   *
   * @param employeeId - Employee profile ID
   * @param fromDate - Start date (inclusive)
   * @param toDate - End date (inclusive)
   * @returns Array of resolved unavailability per date
   */
  async resolveUnavailability(
    employeeId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<ResolvedUnavailability[]> {
    // Normalize dates to start of day
    const from = this.startOfDay(fromDate);
    const to = this.startOfDay(toDate);

    // Load active rules that overlap with the date range
    const rules = await this.prisma.employeeUnavailabilityRule.findMany({
      where: {
        employeeId,
        status: UnavailabilityRuleStatus.ACTIVE,
        OR: [
          // Rule with no effective dates (applies indefinitely)
          { effectiveFrom: null, effectiveTo: null },
          // Rule starts before or during range, no end date
          { effectiveFrom: { lte: to }, effectiveTo: null },
          // Rule ends after or during range, no start date
          { effectiveFrom: null, effectiveTo: { gte: from } },
          // Rule overlaps with range
          {
            effectiveFrom: { lte: to },
            effectiveTo: { gte: from },
          },
        ],
      },
    });

    // Load exceptions for the date range
    const exceptions = await this.prisma.employeeUnavailabilityException.findMany({
      where: {
        employeeId,
        dateLocal: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        dateLocal: 'asc',
      },
    });

    // Group exceptions by date
    const exceptionsByDate = new Map<string, typeof exceptions>();
    for (const exception of exceptions) {
      const dateKey = this.dateKey(exception.dateLocal);
      if (!exceptionsByDate.has(dateKey)) {
        exceptionsByDate.set(dateKey, []);
      }
      exceptionsByDate.get(dateKey)!.push(exception);
    }

    // Expand rules into date occurrences
    const resolvedByDate = new Map<string, ResolvedUnavailability>();

    for (const rule of rules) {
      const occurrences = this.expandWeeklyRule(rule, from, to);

      for (const occurrence of occurrences) {
        const dateKey = this.dateKey(occurrence.date);
        if (!resolvedByDate.has(dateKey)) {
          resolvedByDate.set(dateKey, {
            date: occurrence.date,
            windows: [],
          });
        }

        const resolved = resolvedByDate.get(dateKey)!;
        resolved.windows.push(...occurrence.windows);
      }
    }

    // Apply exceptions
    for (const [dateKey, dateExceptions] of exceptionsByDate.entries()) {
      const resolved = resolvedByDate.get(dateKey);
      const date = this.parseDateKey(dateKey);

      // Sort exceptions: REPLACE first, then REMOVE, then ADD
      const sortedExceptions = [...dateExceptions].sort((a, b) => {
        const order = { REPLACE: 0, REMOVE: 1, ADD: 2 };
        return order[a.type] - order[b.type];
      });

      let windows: TimeWindow[] = resolved ? [...resolved.windows] : [];

      for (const exception of sortedExceptions) {
        windows = this.applyException(windows, exception, date);
      }

      if (windows.length > 0 || dateExceptions.length > 0) {
        resolvedByDate.set(dateKey, {
          date,
          windows: this.mergeWindows(windows),
        });
      }
    }

    // Convert map to array and sort by date
    const result = Array.from(resolvedByDate.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    return result;
  }

  /**
   * Expand a weekly rule into date occurrences within a range.
   */
  private expandWeeklyRule(
    rule: {
      byweekday: number[];
      allDay: boolean;
      startTimeLocal: string | null;
      endTimeLocal: string | null;
      timezone: string;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
    },
    from: Date,
    to: Date,
  ): Array<{ date: Date; windows: TimeWindow[] }> {
    const occurrences: Array<{ date: Date; windows: TimeWindow[] }> = [];
    const current = new Date(from);

    // Determine effective range
    const effectiveFrom = rule.effectiveFrom
      ? this.startOfDay(rule.effectiveFrom)
      : from;
    const effectiveTo = rule.effectiveTo ? this.startOfDay(rule.effectiveTo) : to;

    while (current <= to) {
      // Get weekday: 0=Sunday, 1=Monday, ..., 6=Saturday
      // Convert to our format: 1=Monday, 2=Tuesday, ..., 7=Sunday
      const dayOfWeek = current.getDay();
      const weekdayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

      if (
        rule.byweekday.includes(weekdayNumber) &&
        current >= effectiveFrom &&
        current <= effectiveTo
      ) {
        const windows = this.createWindowsForRule(rule, current);
        occurrences.push({ date: new Date(current), windows });
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return occurrences;
  }

  /**
   * Create time windows for a rule on a specific date.
   */
  private createWindowsForRule(
    rule: {
      allDay: boolean;
      startTimeLocal: string | null;
      endTimeLocal: string | null;
      timezone: string;
    },
    date: Date,
  ): TimeWindow[] {
    if (rule.allDay) {
      // Full-day unavailability
      const start = this.startOfDay(date);
      const end = this.endOfDay(date);
      return [{ start, end }];
    }

    if (!rule.startTimeLocal || !rule.endTimeLocal) {
      return [];
    }

    // Parse times in local timezone
    const start = this.parseLocalTime(rule.startTimeLocal, date, rule.timezone);
    const end = this.parseLocalTime(rule.endTimeLocal, date, rule.timezone);

    // Handle overnight windows (end < start)
    if (end < start) {
      // Window spans midnight: split into two windows
      const endOfDay = this.endOfDay(date);
      const startOfNextDay = this.startOfDay(new Date(date.getTime() + 24 * 60 * 60 * 1000));
      return [
        { start, end: endOfDay },
        { start: startOfNextDay, end },
      ];
    }

    return [{ start, end }];
  }

  /**
   * Apply an exception to existing windows.
   */
  private applyException(
    windows: TimeWindow[],
    exception: {
      type: string;
      allDay: boolean;
      startTimeLocal: string | null;
      endTimeLocal: string | null;
      timezone: string;
    },
    date: Date,
  ): TimeWindow[] {
    const exceptionWindows = this.createWindowsForRule(exception, date);

    switch (exception.type) {
      case 'REPLACE':
        // Replace all windows for this date with exception windows
        return exceptionWindows;

      case 'REMOVE':
        // Remove exception windows from existing windows
        return this.subtractWindows(windows, exceptionWindows);

      case 'ADD':
        // Add exception windows to existing windows
        return this.mergeWindows([...windows, ...exceptionWindows]);

      default:
        return windows;
    }
  }

  /**
   * Merge overlapping or adjacent windows.
   */
  private mergeWindows(windows: TimeWindow[]): TimeWindow[] {
    if (windows.length === 0) return [];

    // Sort by start time
    const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: TimeWindow[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      // If current overlaps or is adjacent to last, merge them
      if (current.start <= last.end) {
        last.end = current.end > last.end ? current.end : last.end;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Subtract exception windows from existing windows.
   */
  private subtractWindows(windows: TimeWindow[], exceptions: TimeWindow[]): TimeWindow[] {
    let result = [...windows];

    for (const exception of exceptions) {
      const newResult: TimeWindow[] = [];

      for (const window of result) {
        // If window doesn't overlap with exception, keep it
        if (window.end <= exception.start || window.start >= exception.end) {
          newResult.push(window);
          continue;
        }

        // Window overlaps with exception - split it
        if (window.start < exception.start) {
          newResult.push({ start: window.start, end: exception.start });
        }
        if (window.end > exception.end) {
          newResult.push({ start: exception.end, end: window.end });
        }
      }

      result = newResult;
    }

    return result;
  }

  /**
   * Parse local time string (HH:mm) to Date in the given timezone.
   * Note: We store times in local timezone and don't convert to UTC.
   */
  private parseLocalTime(timeString: string, date: Date, timezone: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);
    // Note: In a production system, you'd use a library like date-fns-tz or moment-timezone
    // to properly handle timezone conversions. For now, we assume the timezone is handled
    // at the application level and store times as-is.
    return localDate;
  }

  /**
   * Get start of day for a date.
   */
  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day for a date.
   */
  private endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get date key for grouping (YYYY-MM-DD).
   */
  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse date key back to Date.
   */
  private parseDateKey(key: string): Date {
    return this.startOfDay(new Date(key));
  }
}
