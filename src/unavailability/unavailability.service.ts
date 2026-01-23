import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnavailabilityRuleDto } from './dtos/create-unavailability-rule.dto';
import { CreateUnavailabilityExceptionDto } from './dtos/create-unavailability-exception.dto';
import { AppRole } from '../common/enums/role.enum';
import { UnavailabilityRuleStatus } from '@prisma/client';

@Injectable()
export class UnavailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a single unavailability rule.
   * Employees can only create rules for themselves.
   */
  async createRule(
    employeeId: string,
    companyId: string,
    userId: string,
    userRole: AppRole,
    dto: CreateUnavailabilityRuleDto,
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
        throw new ForbiddenException('You can only create unavailability rules for yourself');
      }
    }

    // Validate: if allDay is false, startTimeLocal and endTimeLocal are required
    if (!dto.allDay && (!dto.startTimeLocal || !dto.endTimeLocal)) {
      throw new BadRequestException(
        'startTimeLocal and endTimeLocal are required when allDay is false',
      );
    }

    // Validate byweekday array
    if (!dto.byweekday || dto.byweekday.length === 0) {
      throw new BadRequestException('byweekday must contain at least one weekday');
    }

    // Validate weekday numbers (1-7)
    for (const day of dto.byweekday) {
      if (day < 1 || day > 7) {
        throw new BadRequestException('byweekday must contain numbers between 1 and 7');
      }
    }

    // Parse effective dates
    const effectiveFrom = dto.effectiveFrom
      ? this.parseDate(dto.effectiveFrom)
      : null;
    const effectiveTo = dto.effectiveTo ? this.parseDate(dto.effectiveTo) : null;

    // Validate effective date range
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
      throw new BadRequestException('effectiveFrom must be before or equal to effectiveTo');
    }

    // Create rule
    return this.prisma.employeeUnavailabilityRule.create({
      data: {
        employeeId,
        companyId,
        timezone: dto.timezone,
        freq: dto.freq,
        byweekday: dto.byweekday,
        allDay: dto.allDay,
        startTimeLocal: dto.allDay ? null : dto.startTimeLocal || null,
        endTimeLocal: dto.allDay ? null : dto.endTimeLocal || null,
        effectiveFrom,
        effectiveTo,
        status: dto.status || UnavailabilityRuleStatus.ACTIVE,
        note: dto.note || null,
        createdByUserId: userId,
      },
    });
  }

  /**
   * Create multiple unavailability rules in a single transaction.
   */
  async bulkCreateRules(
    employeeId: string,
    companyId: string,
    userId: string,
    userRole: AppRole,
    dtos: CreateUnavailabilityRuleDto[],
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
        throw new ForbiddenException('You can only create unavailability rules for yourself');
      }
    }

    // Validate all rules before processing
    for (const dto of dtos) {
      if (!dto.allDay && (!dto.startTimeLocal || !dto.endTimeLocal)) {
        throw new BadRequestException(
          'startTimeLocal and endTimeLocal are required when allDay is false',
        );
      }

      if (!dto.byweekday || dto.byweekday.length === 0) {
        throw new BadRequestException('byweekday must contain at least one weekday');
      }

      for (const day of dto.byweekday) {
        if (day < 1 || day > 7) {
          throw new BadRequestException('byweekday must contain numbers between 1 and 7');
        }
      }

      const effectiveFrom = dto.effectiveFrom ? this.parseDate(dto.effectiveFrom) : null;
      const effectiveTo = dto.effectiveTo ? this.parseDate(dto.effectiveTo) : null;

      if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
        throw new BadRequestException('effectiveFrom must be before or equal to effectiveTo');
      }
    }

    // Create all rules in a transaction
    return this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.employeeUnavailabilityRule.create({
          data: {
            employeeId,
            companyId,
            timezone: dto.timezone,
            freq: dto.freq,
            byweekday: dto.byweekday,
            allDay: dto.allDay,
            startTimeLocal: dto.allDay ? null : dto.startTimeLocal || null,
            endTimeLocal: dto.allDay ? null : dto.endTimeLocal || null,
            effectiveFrom: dto.effectiveFrom ? this.parseDate(dto.effectiveFrom) : null,
            effectiveTo: dto.effectiveTo ? this.parseDate(dto.effectiveTo) : null,
            status: dto.status || UnavailabilityRuleStatus.ACTIVE,
            note: dto.note || null,
            createdByUserId: userId,
          },
        }),
      ),
    );
  }

  /**
   * Create a single unavailability exception.
   * Employees can only create exceptions for themselves.
   */
  async createException(
    employeeId: string,
    companyId: string,
    userId: string,
    userRole: AppRole,
    dto: CreateUnavailabilityExceptionDto,
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
        throw new ForbiddenException('You can only create unavailability exceptions for yourself');
      }
    }

    // Validate: if allDay is false, startTimeLocal and endTimeLocal are required
    if (!dto.allDay && (!dto.startTimeLocal || !dto.endTimeLocal)) {
      throw new BadRequestException(
        'startTimeLocal and endTimeLocal are required when allDay is false',
      );
    }

    // Parse date
    const dateLocal = this.parseDate(dto.dateLocal);

    // Create exception
    return this.prisma.employeeUnavailabilityException.create({
      data: {
        employeeId,
        companyId,
        dateLocal,
        timezone: dto.timezone,
        type: dto.type,
        allDay: dto.allDay,
        startTimeLocal: dto.allDay ? null : dto.startTimeLocal || null,
        endTimeLocal: dto.allDay ? null : dto.endTimeLocal || null,
        note: dto.note || null,
        createdByUserId: userId,
      },
    });
  }

  /**
   * Get resolved unavailability for an employee within a date range.
   * This is a read-only operation for managers/admins.
   */
  async getUnavailabilityForDateRange(
    employeeId: string,
    companyId: string,
    fromDate: string,
    toDate: string,
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

    const from = this.parseDate(fromDate);
    const to = this.parseDate(toDate);

    if (from > to) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    // Use resolver service to compute unavailability
    // Note: We'll inject this in the constructor
    return {
      employeeId,
      companyId,
      fromDate: from,
      toDate: to,
      // The actual resolution will be done by the resolver service
      // This method signature is for the controller
    };
  }

  /**
   * Parse date string (YYYY-MM-DD) to Date object.
   */
  private parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    }
    // Set to start of day
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
