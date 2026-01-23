import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

export interface AvailabilityConstraintResult {
  allowed: boolean;
  blocked: boolean;
  requiresOverride: boolean;
  reason?: string;
}

/**
 * Reusable service for checking if a shift falls within an employee's availability.
 * This service is stateless and designed for use in shift creation and future auto-rostering.
 */
@Injectable()
export class AvailabilityConstraintService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a shift is allowed based on employee availability.
   *
   * @param employeeId - Employee profile ID
   * @param companyId - Company ID
   * @param shiftDate - Date of the shift
   * @param shiftStartTime - Start time of the shift (Date object)
   * @param shiftEndTime - End time of the shift (Date object)
   * @returns Constraint result indicating if shift is allowed, blocked, or requires override
   */
  async checkAvailability(
    employeeId: string,
    companyId: string,
    shiftDate: Date,
    shiftStartTime: Date,
    shiftEndTime: Date,
  ): Promise<AvailabilityConstraintResult> {
    // Get employee's availability
    const availability = await this.prisma.employeeAvailability.findUnique({
      where: {
        employeeId_companyId: {
          employeeId,
          companyId,
        },
      },
      include: {
        windows: true,
        overrides: {
          where: {
            overrideDate: {
              gte: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate()),
              lt: new Date(
                shiftDate.getFullYear(),
                shiftDate.getMonth(),
                shiftDate.getDate() + 1,
              ),
            },
          },
        },
      },
    });

    // If no availability defined, allow (no constraint)
    if (!availability) {
      return {
        allowed: true,
        blocked: false,
        requiresOverride: false,
      };
    }

    // Check effective date range (compare dates only, not times)
    const shiftDateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
    
    if (availability.effectiveFrom) {
      const effectiveFromDate = new Date(
        availability.effectiveFrom.getFullYear(),
        availability.effectiveFrom.getMonth(),
        availability.effectiveFrom.getDate(),
      );
      if (shiftDateOnly < effectiveFromDate) {
        return {
          allowed: true,
          blocked: false,
          requiresOverride: false,
          reason: 'Availability not yet effective',
        };
      }
    }

    if (availability.effectiveTo) {
      const effectiveToDate = new Date(
        availability.effectiveTo.getFullYear(),
        availability.effectiveTo.getMonth(),
        availability.effectiveTo.getDate(),
      );
      if (shiftDateOnly > effectiveToDate) {
        return {
          allowed: true,
          blocked: false,
          requiresOverride: false,
          reason: 'Availability has expired',
        };
      }
    }

    // Check for date-specific override first (overrides take precedence)
    if (availability.overrides.length > 0) {
      const override = availability.overrides[0]; // Should only be one per date
      if (override.startTime === null || override.endTime === null) {
        // Unavailable all day
        return {
          allowed: false,
          blocked: true,
          requiresOverride: true,
          reason: `Override: ${override.reason}`,
        };
      }

      // Check if shift falls within override window
      const overrideStart = this.parseTime(override.startTime, shiftDate);
      const overrideEnd = this.parseTime(override.endTime, shiftDate);

      if (shiftStartTime >= overrideStart && shiftEndTime <= overrideEnd) {
        return {
          allowed: true,
          blocked: false,
          requiresOverride: false,
        };
      } else {
        return {
          allowed: false,
          blocked: true,
          requiresOverride: true,
          reason: `Override: ${override.reason}`,
        };
      }
    }

    // Check recurring availability windows
    const dayOfWeek = this.getDayOfWeek(shiftDate);
    const dayWindows = availability.windows.filter((w) => w.dayOfWeek === dayOfWeek);

    if (dayWindows.length === 0) {
      // No availability defined for this day
      return {
        allowed: false,
        blocked: true,
        requiresOverride: true,
        reason: 'No availability defined for this day',
      };
    }

    // Check if shift falls within any window
    const shiftStartMinutes = this.timeToMinutes(shiftStartTime);
    const shiftEndMinutes = this.timeToMinutes(shiftEndTime);

    for (const window of dayWindows) {
      const windowStart = this.timeStringToMinutes(window.startTime);
      const windowEnd = this.timeStringToMinutes(window.endTime);

      // Check if shift is completely within this window
      if (shiftStartMinutes >= windowStart && shiftEndMinutes <= windowEnd) {
        return {
          allowed: true,
          blocked: false,
          requiresOverride: false,
        };
      }
    }

    // Shift does not fall within any availability window
    return {
      allowed: false,
      blocked: true,
      requiresOverride: true,
      reason: 'Shift falls outside defined availability windows',
    };
  }

  /**
   * Convert Date to DayOfWeek enum
   */
  private getDayOfWeek(date: Date): DayOfWeek {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayMap: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return dayMap[day];
  }

  /**
   * Parse time string (HH:mm) to Date on a specific date
   */
  private parseTime(timeString: string, date: Date): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Convert time string (HH:mm) to minutes since midnight
   */
  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert Date to minutes since midnight
   */
  private timeToMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }
}
