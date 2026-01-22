import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnavailabilityDto } from './dtos/create-unavailability.dto';
import { AppRole } from '../common/enums/role.enum';

@Injectable()
export class UnavailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a single unavailability entry.
   * Employees can only create unavailability for themselves.
   */
  async create(
    employeeId: string,
    companyId: string,
    userId: string,
    userRole: AppRole,
    dto: CreateUnavailabilityDto,
  ) {
    // Verify employee belongs to company
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: employeeId,
        companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or does not belong to company');
    }

    // Verify ownership (employees can only create their own)
    if (userRole === AppRole.EMPLOYEE) {
      const userEmployee = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });

      if (!userEmployee || userEmployee.id !== employeeId) {
        throw new ForbiddenException('You can only create unavailability for yourself');
      }
    }

    // Validate and normalize date
    const date = new Date(dto.date);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Validate time ordering if both times provided
    if (dto.startTime && dto.endTime) {
      const startMinutes = this.timeStringToMinutes(dto.startTime);
      const endMinutes = this.timeStringToMinutes(dto.endTime);

      if (startMinutes >= endMinutes) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }

    // Check for overlapping unavailability on the same date
    await this.checkOverlaps(employeeId, companyId, dateOnly, dto.startTime, dto.endTime);

    // Create unavailability
    return this.prisma.employeeUnavailability.create({
      data: {
        employeeId,
        companyId,
        date: dateOnly,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        reason: dto.reason || null,
        createdByUserId: userId,
      },
    });
  }

  /**
   * Create multiple unavailability entries in a single transaction.
   * Employees can only create unavailability for themselves.
   */
  async bulkCreate(
    employeeId: string,
    companyId: string,
    userId: string,
    userRole: AppRole,
    dtos: CreateUnavailabilityDto[],
  ) {
    // Verify employee belongs to company
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: employeeId,
        companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or does not belong to company');
    }

    // Verify ownership
    if (userRole === AppRole.EMPLOYEE) {
      const userEmployee = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });

      if (!userEmployee || userEmployee.id !== employeeId) {
        throw new ForbiddenException('You can only create unavailability for yourself');
      }
    }

    // Validate all entries before processing
    const normalizedEntries: Array<{
      date: Date;
      startTime: string | null;
      endTime: string | null;
      reason: string | null;
    }> = [];

    // Track dates to detect duplicates in bulk payload
    const seenDates = new Set<string>();

    for (const dto of dtos) {
      const date = new Date(dto.date);
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateKey = dateOnly.toISOString();

      // Check for duplicates in bulk payload
      if (seenDates.has(dateKey)) {
        throw new BadRequestException(
          `Duplicate unavailability entry for date ${dto.date} in bulk payload`,
        );
      }
      seenDates.add(dateKey);

      // Validate time ordering
      if (dto.startTime && dto.endTime) {
        const startMinutes = this.timeStringToMinutes(dto.startTime);
        const endMinutes = this.timeStringToMinutes(dto.endTime);

        if (startMinutes >= endMinutes) {
          throw new BadRequestException(
            `For date ${dto.date}, startTime must be before endTime`,
          );
        }
      }

      normalizedEntries.push({
        date: dateOnly,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        reason: dto.reason || null,
      });
    }

    // Check for overlaps with existing unavailability and within bulk payload
    for (const entry of normalizedEntries) {
      // Check existing unavailability
      await this.checkOverlaps(
        employeeId,
        companyId,
        entry.date,
        entry.startTime || undefined,
        entry.endTime || undefined,
      );

      // Check overlaps within bulk payload
      for (const otherEntry of normalizedEntries) {
        if (entry === otherEntry) continue;

        // Same date - check time overlap
        if (
          entry.date.getTime() === otherEntry.date.getTime() &&
          this.doTimeRangesOverlap(
            entry.startTime,
            entry.endTime,
            otherEntry.startTime,
            otherEntry.endTime,
          )
        ) {
          throw new BadRequestException(
            `Overlapping unavailability entries for date ${entry.date.toISOString().split('T')[0]}`,
          );
        }
      }
    }

    // Create all entries in a transaction
    return this.prisma.$transaction(
      normalizedEntries.map((entry) =>
        this.prisma.employeeUnavailability.create({
          data: {
            employeeId,
            companyId,
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            reason: entry.reason,
            createdByUserId: userId,
          },
        }),
      ),
    );
  }

  /**
   * Check for overlapping unavailability records.
   */
  private async checkOverlaps(
    employeeId: string,
    companyId: string,
    date: Date,
    startTime?: string,
    endTime?: string,
  ) {
    const existing = await this.prisma.employeeUnavailability.findMany({
      where: {
        employeeId,
        companyId,
        date: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    });

    for (const record of existing) {
      // Full-day unavailability conflicts with any other entry
      if (
        (record.startTime === null && record.endTime === null) ||
        (startTime === undefined && endTime === undefined)
      ) {
        throw new ConflictException(
          `Unavailability already exists for date ${date.toISOString().split('T')[0]}`,
        );
      }

      // Check time overlap
      if (
        this.doTimeRangesOverlap(
          record.startTime,
          record.endTime,
          startTime || null,
          endTime || null,
        )
      ) {
        throw new ConflictException(
          `Overlapping unavailability for date ${date.toISOString().split('T')[0]}`,
        );
      }
    }
  }

  /**
   * Check if two time ranges overlap.
   * Handles full-day (null times) and partial-day unavailability.
   */
  private doTimeRangesOverlap(
    start1: string | null | undefined,
    end1: string | null | undefined,
    start2: string | null | undefined,
    end2: string | null | undefined,
  ): boolean {
    // If either is full-day (both null), they overlap
    if (
      (start1 === null && end1 === null) ||
      (start2 === null && end2 === null) ||
      (start1 === undefined && end1 === undefined) ||
      (start2 === undefined && end2 === undefined)
    ) {
      return true;
    }

    // If one is full-day and other is partial, they overlap
    if (
      (start1 === null || start1 === undefined) ||
      (start2 === null || start2 === undefined)
    ) {
      return true;
    }

    // Both are partial-day - check time overlap
    const start1Minutes = this.timeStringToMinutes(start1!);
    const end1Minutes = this.timeStringToMinutes(end1!);
    const start2Minutes = this.timeStringToMinutes(start2!);
    const end2Minutes = this.timeStringToMinutes(end2!);

    // Overlap occurs if: start1 < end2 && end1 > start2
    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  }

  /**
   * Convert time string (HH:mm) to minutes since midnight
   */
  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
