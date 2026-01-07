import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dtos/create-shift.dto';
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

    // Create the shift
    return this.prisma.shift.create({
      data: {
        employeeId,
        companyId,
        workLocationId: workLocationId || null,
        startAt,
        endAt,
        type,
        paidBreakMinutes,
        unpaidBreakMinutes,
      },
    });
  }
}

