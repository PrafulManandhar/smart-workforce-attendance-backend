import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dtos/create-shift.dto';
import { UpdateShiftDto } from './dtos/update-shift.dto';
import { ShiftType } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createShiftDto: CreateShiftDto) {
    const {
      employeeId,
      workLocationId,
      startAt,
      endAt,
      paidBreakMinutes = 0,
      unpaidBreakMinutes = 0,
      type = ShiftType.OTHER,
    } = createShiftDto;

    // Validate startAt < endAt
    if (startAt >= endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    // Validate break minutes >= 0 (already validated in DTO, but double-check)
    if (paidBreakMinutes < 0 || unpaidBreakMinutes < 0) {
      throw new BadRequestException('Break minutes must be greater than or equal to 0');
    }

    // Validate break minutes don't exceed shift duration
    const shiftDurationMinutes = (endAt.getTime() - startAt.getTime()) / (1000 * 60);
    const totalBreakMinutes = paidBreakMinutes + unpaidBreakMinutes;
    if (totalBreakMinutes > shiftDurationMinutes) {
      throw new BadRequestException(
        `Total break minutes (${totalBreakMinutes}) cannot exceed shift duration (${shiftDurationMinutes} minutes)`,
      );
    }

    // Validate employee belongs to company
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: employeeId,
        companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or does not belong to company');
    }

    // Validate work location if provided
    if (workLocationId) {
      const workLocation = await this.prisma.workLocation.findFirst({
        where: {
          id: workLocationId,
          companyId,
          isActive: true,
        },
      });

      if (!workLocation) {
        throw new NotFoundException('Work location not found, not active, or does not belong to company');
      }
    }

    // Check for overlapping shifts for the same employee
    // Two shifts overlap if: startAt1 < endAt2 AND endAt1 > startAt2
    const overlappingShift = await this.prisma.shift.findFirst({
      where: {
        employeeId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (overlappingShift) {
      throw new ConflictException(
        `Shift overlaps with existing shift (ID: ${overlappingShift.id}) from ${overlappingShift.startAt} to ${overlappingShift.endAt}`,
      );
    }

    // Create the shift (default status is PUBLISHED from schema)
    return this.prisma.shift.create({
      data: {
        employeeId,
        companyId,
        workLocationId: workLocationId || null,
        startAt,
        endAt,
        type,
        status: 'PUBLISHED', // Explicitly set, though schema default handles it
        paidBreakMinutes,
        unpaidBreakMinutes,
      },
    });
  }

  async findAll(
    companyId: string,
    from: Date,
    to: Date,
    employeeId?: string,
    workLocationId?: string,
  ) {
    // Build where clause
    const where: any = {
      companyId,
      // Shifts that overlap with the date range
      // A shift overlaps if: startAt <= to AND endAt >= from
      startAt: { lte: to },
      endAt: { gte: from },
      // Admin list shows all shifts including CANCELLED, so no status filter
    };

    // Add optional filters
    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (workLocationId) {
      where.workLocationId = workLocationId;
    }

    // Query shifts with workLocation fields
    return this.prisma.shift.findMany({
      where,
      orderBy: {
        startAt: 'asc',
      },
      select: {
        id: true,
        employeeId: true,
        companyId: true,
        workLocationId: true,
        startAt: true,
        endAt: true,
        type: true,
        status: true,
        paidBreakMinutes: true,
        unpaidBreakMinutes: true,
        createdAt: true,
        updatedAt: true,
        workLocation: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
  }

  async update(id: string, companyId: string, updateShiftDto: UpdateShiftDto) {
    // Find existing shift and validate company ownership
    const existingShift = await this.prisma.shift.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        attendanceSessions: true,
      },
    });

    if (!existingShift) {
      throw new NotFoundException('Shift not found or does not belong to company');
    }

    // Check if AttendanceSession exists - if yes, shift is locked
    if (existingShift.attendanceSessions && existingShift.attendanceSessions.length > 0) {
      throw new ConflictException('Shift is locked because attendance has started');
    }

    // Merge update data with existing shift data
    const mergedData = {
      employeeId: updateShiftDto.employeeId ?? existingShift.employeeId,
      workLocationId: updateShiftDto.workLocationId !== undefined 
        ? (updateShiftDto.workLocationId || null)
        : existingShift.workLocationId,
      startAt: updateShiftDto.startAt ?? existingShift.startAt,
      endAt: updateShiftDto.endAt ?? existingShift.endAt,
      type: updateShiftDto.type ?? existingShift.type,
      paidBreakMinutes: updateShiftDto.paidBreakMinutes ?? existingShift.paidBreakMinutes ?? 0,
      unpaidBreakMinutes: updateShiftDto.unpaidBreakMinutes ?? existingShift.unpaidBreakMinutes ?? 0,
    };

    // Re-run validations

    // Validate startAt < endAt
    if (mergedData.startAt >= mergedData.endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    // Validate break minutes >= 0
    if (mergedData.paidBreakMinutes < 0 || mergedData.unpaidBreakMinutes < 0) {
      throw new BadRequestException('Break minutes must be greater than or equal to 0');
    }

    // Validate break minutes don't exceed shift duration
    const shiftDurationMinutes = (mergedData.endAt.getTime() - mergedData.startAt.getTime()) / (1000 * 60);
    const totalBreakMinutes = mergedData.paidBreakMinutes + mergedData.unpaidBreakMinutes;
    if (totalBreakMinutes > shiftDurationMinutes) {
      throw new BadRequestException(
        `Total break minutes (${totalBreakMinutes}) cannot exceed shift duration (${shiftDurationMinutes} minutes)`,
      );
    }

    // Validate employee belongs to company
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: mergedData.employeeId,
        companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or does not belong to company');
    }

    // Validate work location if provided
    if (mergedData.workLocationId) {
      const workLocation = await this.prisma.workLocation.findFirst({
        where: {
          id: mergedData.workLocationId,
          companyId,
          isActive: true,
        },
      });

      if (!workLocation) {
        throw new NotFoundException('Work location not found, not active, or does not belong to company');
      }
    }

    // Check for overlapping shifts for the same employee (excluding current shift)
    // Two shifts overlap if: startAt1 < endAt2 AND endAt1 > startAt2
    const overlappingShift = await this.prisma.shift.findFirst({
      where: {
        employeeId: mergedData.employeeId,
        id: { not: id }, // Exclude current shift
        startAt: { lt: mergedData.endAt },
        endAt: { gt: mergedData.startAt },
      },
    });

    if (overlappingShift) {
      throw new ConflictException(
        `Shift overlaps with existing shift (ID: ${overlappingShift.id}) from ${overlappingShift.startAt} to ${overlappingShift.endAt}`,
      );
    }

    // Update the shift
    return this.prisma.shift.update({
      where: { id },
      data: {
        employeeId: mergedData.employeeId,
        workLocationId: mergedData.workLocationId,
        startAt: mergedData.startAt,
        endAt: mergedData.endAt,
        type: mergedData.type,
        status: existingShift.status, // Preserve existing status (only cancel endpoint changes it)
        paidBreakMinutes: mergedData.paidBreakMinutes,
        unpaidBreakMinutes: mergedData.unpaidBreakMinutes,
      },
    });
  }

  async cancel(id: string, companyId: string) {
    // Find existing shift and validate company ownership
    const existingShift = await this.prisma.shift.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existingShift) {
      throw new NotFoundException('Shift not found or does not belong to company');
    }

    // Update shift status to CANCELLED
    return this.prisma.shift.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}

