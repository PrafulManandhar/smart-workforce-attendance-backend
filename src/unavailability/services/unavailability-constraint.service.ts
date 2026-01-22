import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UnavailabilityConstraintResult {
  blocked: boolean;
  allowed: boolean;
  reason?: string;
}

/**
 * Reusable service for checking if a shift is blocked by employee unavailability.
 * This service is stateless and designed as a read-only hook for future integration.
 * 
 * ⚠️ This service does NOT modify shift creation logic directly.
 * It only exposes the constraint check for future integration.
 */
@Injectable()
export class UnavailabilityConstraintService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a shift is blocked by employee unavailability.
   *
   * @param employeeId - Employee profile ID
   * @param companyId - Company ID
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
    // Normalize date to start of day for comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const nextDay = new Date(dateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find unavailability records for this employee, company, and date
    const unavailabilities = await this.prisma.employeeUnavailability.findMany({
      where: {
        employeeId,
        companyId,
        date: {
          gte: dateOnly,
          lt: nextDay,
        },
      },
    });

    // If no unavailability records, allow
    if (unavailabilities.length === 0) {
      return {
        blocked: false,
        allowed: true,
      };
    }

    // Check each unavailability record
    for (const unavailability of unavailabilities) {
      // Full-day unavailability (both startTime and endTime are null)
      if (unavailability.startTime === null && unavailability.endTime === null) {
        return {
          blocked: true,
          allowed: false,
          reason: unavailability.reason || 'Full-day unavailability',
        };
      }

      // Partial-day unavailability - check if shift overlaps
      if (unavailability.startTime && unavailability.endTime) {
        const unavailStart = this.parseTime(unavailability.startTime, date);
        const unavailEnd = this.parseTime(unavailability.endTime, date);

        // Check if shift overlaps with unavailability window
        // Overlap occurs if: shiftStartTime < unavailEnd && shiftEndTime > unavailStart
        if (shiftStartTime < unavailEnd && shiftEndTime > unavailStart) {
          return {
            blocked: true,
            allowed: false,
            reason: unavailability.reason || 'Time-based unavailability',
          };
        }
      }
    }

    // No overlap found
    return {
      blocked: false,
      allowed: true,
    };
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
}
