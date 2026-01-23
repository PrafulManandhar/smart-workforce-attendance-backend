import { Injectable } from '@nestjs/common';
import { UnavailabilityResolverService } from './unavailability-resolver.service';

export interface UnavailabilityConstraintResult {
  blocked: boolean;
  allowed: boolean;
  reason?: string;
}

/**
 * Reusable service for checking if a shift is blocked by employee unavailability.
 * This service uses the UnavailabilityResolverService to resolve rules and exceptions,
 * then checks if the shift overlaps with any blocked time windows.
 *
 * ⚠️ This service does NOT modify shift creation logic directly.
 * It only exposes the constraint check for future integration.
 */
@Injectable()
export class UnavailabilityConstraintService {
  constructor(private readonly resolverService: UnavailabilityResolverService) {}

  /**
   * Check if a shift is blocked by employee unavailability.
   *
   * @param employeeId - Employee profile ID
   * @param companyId - Company ID (not used in resolver, but kept for API consistency)
   * @param date - Date of the shift
   * @param shiftStartTime - Start time of the shift (Date object)
   * @param shiftEndTime - End time of the shift (Date object)
   * @returns Constraint result indicating if shift is blocked
   */
  async checkUnavailability(
    employeeId: string,
    companyId: string,
    date: Date,
    shiftStartTime: Date,
    shiftEndTime: Date,
  ): Promise<UnavailabilityConstraintResult> {
    // Normalize date to start of day
    const dateOnly = this.startOfDay(date);
    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    // Resolve unavailability for this date
    const resolved = await this.resolverService.resolveUnavailability(
      employeeId,
      dateOnly,
      this.startOfDay(new Date(nextDay.getTime() - 1)), // End of day
    );

    // Find unavailability for this specific date
    const dateKey = this.dateKey(dateOnly);
    const dayUnavailability = resolved.find((item) => this.dateKey(item.date) === dateKey);

    if (!dayUnavailability || dayUnavailability.windows.length === 0) {
      return {
        blocked: false,
        allowed: true,
      };
    }

    // Check if shift overlaps with any blocked windows
    for (const window of dayUnavailability.windows) {
      // Overlap occurs if: shiftStartTime < window.end && shiftEndTime > window.start
      if (shiftStartTime < window.end && shiftEndTime > window.start) {
        return {
          blocked: true,
          allowed: false,
          reason: 'Unavailable during this time',
        };
      }
    }

    // No overlap found
    return {
      blocked: false,
      allowed: true,
    };
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
   * Get date key for comparison (YYYY-MM-DD).
   */
  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
