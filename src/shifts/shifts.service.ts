import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dtos/create-shift.dto';
import { UpdateShiftDto } from './dtos/update-shift.dto';
import { BulkCreateShiftDto } from './dtos/bulk-create-shift.dto';
import { ShiftType } from '@prisma/client';
import { AvailabilityConstraintService } from '../availability/services/availability-constraint.service';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityConstraintService: AvailabilityConstraintService,
  ) {}

  async create(companyId: string, createShiftDto: CreateShiftDto) {
    const {
      employeeId,
      departmentId,
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

    // Validate department (required, same company)
    if (!departmentId) {
      throw new BadRequestException('Department is required for creating a shift');
    }

    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId,
      },
    });

    if (!department) {
      throw new BadRequestException('Department is required for creating a shift');
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

    // Check availability constraint
    const shiftDate = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
    const constraintResult = await this.availabilityConstraintService.checkAvailability(
      employeeId,
      companyId,
      shiftDate,
      startAt,
      endAt,
    );

    // If shift is blocked by availability, require explicit override
    // For now, we'll block the shift creation if it's outside availability
    // In the future, this could be configurable per company
    if (constraintResult.blocked) {
      throw new BadRequestException(
        `Shift falls outside employee availability. ${constraintResult.reason || 'Shift requires override.'}`,
      );
    }

    // Create the shift (default status is PUBLISHED from schema)
    return this.prisma.shift.create({
      data: {
        employeeId,
        companyId,
        departmentId,
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
      departmentId:
        updateShiftDto.departmentId !== undefined
          ? (updateShiftDto.departmentId || null)
          : (existingShift as any).departmentId ?? null,
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

    // If departmentId is being changed, validate new department in same company
    if (updateShiftDto.departmentId !== undefined) {
      if (!mergedData.departmentId) {
        throw new BadRequestException('Department is required for creating a shift');
      }

      const department = await this.prisma.department.findFirst({
        where: {
          id: mergedData.departmentId,
          companyId,
        },
      });

      if (!department) {
        throw new BadRequestException('Department is required for creating a shift');
      }
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
        departmentId: mergedData.departmentId,
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

  async bulkCreate(companyId: string, bulkCreateShiftDto: BulkCreateShiftDto) {
    const shifts = bulkCreateShiftDto.shifts;

    if (!shifts || shifts.length === 0) {
      throw new BadRequestException('Shifts array cannot be empty');
    }

    // Validate all shifts first before creating any
    // Collect all employee IDs, department IDs, and work location IDs for batch validation
    const employeeIds = [...new Set(shifts.map((s) => s.employeeId))];
    const departmentIds = [
      ...new Set(shifts.map((s) => s.departmentId).filter((id): id is string => !!id)),
    ];
    const workLocationIds = [
      ...new Set(shifts.map((s) => s.workLocationId).filter((id): id is string => !!id)),
    ];

    // Batch validate employees
    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        id: { in: employeeIds },
        companyId,
      },
    });

    const validEmployeeIds = new Set(employees.map((e) => e.id));
    for (const shift of shifts) {
      if (!validEmployeeIds.has(shift.employeeId)) {
        throw new NotFoundException(
          `Employee ${shift.employeeId} not found or does not belong to company`,
        );
      }
    }

    // Batch validate departments (required)
    if (departmentIds.length > 0) {
      const departments = await this.prisma.department.findMany({
        where: {
          id: { in: departmentIds },
          companyId,
        },
      });

      const validDepartmentIds = new Set(departments.map((d) => d.id));
      for (const shift of shifts) {
        if (!shift.departmentId || !validDepartmentIds.has(shift.departmentId)) {
          throw new BadRequestException('Department is required for creating a shift');
        }
      }
    } else {
      // No valid departmentIds collected => at least one shift missing department
      throw new BadRequestException('Department is required for creating a shift');
    }

    // Batch validate work locations if provided
    if (workLocationIds.length > 0) {
      const workLocations = await this.prisma.workLocation.findMany({
        where: {
          id: { in: workLocationIds },
          companyId,
          isActive: true,
        },
      });

      const validWorkLocationIds = new Set(workLocations.map((wl) => wl.id));
      for (const shift of shifts) {
        if (shift.workLocationId && !validWorkLocationIds.has(shift.workLocationId)) {
          throw new NotFoundException(
            `Work location ${shift.workLocationId} not found, not active, or does not belong to company`,
          );
        }
      }
    }

    // Validate each shift's time and breaks
    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const {
        startAt,
        endAt,
        paidBreakMinutes = 0,
        unpaidBreakMinutes = 0,
      } = shift;

      // Validate startAt < endAt
      if (startAt >= endAt) {
        throw new BadRequestException(`Shift ${i + 1}: startAt must be before endAt`);
      }

      // Validate break minutes >= 0
      if (paidBreakMinutes < 0 || unpaidBreakMinutes < 0) {
        throw new BadRequestException(
          `Shift ${i + 1}: Break minutes must be greater than or equal to 0`,
        );
      }

      // Validate break minutes don't exceed shift duration
      const shiftDurationMinutes = (endAt.getTime() - startAt.getTime()) / (1000 * 60);
      const totalBreakMinutes = paidBreakMinutes + unpaidBreakMinutes;
      if (totalBreakMinutes > shiftDurationMinutes) {
        throw new BadRequestException(
          `Shift ${i + 1}: Total break minutes (${totalBreakMinutes}) cannot exceed shift duration (${shiftDurationMinutes} minutes)`,
        );
      }
    }

    // Check for overlaps:
    // 1. Between shifts in the batch
    // 2. With existing shifts in the database
    for (let i = 0; i < shifts.length; i++) {
      const shift1 = shifts[i];
      const { employeeId: empId1, startAt: start1, endAt: end1 } = shift1;

      // Check overlaps with other shifts in the batch
      for (let j = i + 1; j < shifts.length; j++) {
        const shift2 = shifts[j];
        const { employeeId: empId2, startAt: start2, endAt: end2 } = shift2;

        // Only check overlaps for the same employee
        if (empId1 === empId2) {
          // Two shifts overlap if: startAt1 < endAt2 AND endAt1 > startAt2
          if (start1 < end2 && end1 > start2) {
            throw new ConflictException(
              `Shift ${i + 1} overlaps with shift ${j + 1} in the batch (same employee ${empId1})`,
            );
          }
        }
      }

      // Check overlaps with existing shifts in database
      const overlappingShift = await this.prisma.shift.findFirst({
        where: {
          employeeId: empId1,
          startAt: { lt: end1 },
          endAt: { gt: start1 },
        },
      });

      if (overlappingShift) {
        throw new ConflictException(
          `Shift ${i + 1} overlaps with existing shift (ID: ${overlappingShift.id}) from ${overlappingShift.startAt} to ${overlappingShift.endAt}`,
        );
      }
    }

    // All validations passed, create all shifts in a transaction
    const createdShifts = await this.prisma.$transaction(
      shifts.map((shift) =>
        this.prisma.shift.create({
          data: {
            employeeId: shift.employeeId,
            companyId,
            workLocationId: shift.workLocationId || null,
            departmentId: shift.departmentId,
            startAt: shift.startAt,
            endAt: shift.endAt,
            type: shift.type ?? ShiftType.OTHER,
            status: 'PUBLISHED',
            paidBreakMinutes: shift.paidBreakMinutes ?? 0,
            unpaidBreakMinutes: shift.unpaidBreakMinutes ?? 0,
          },
        }),
      ),
    );

    return {
      count: createdShifts.length,
      ids: createdShifts.map((shift) => shift.id),
    };
  }
}

