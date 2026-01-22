import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dtos/create-availability.dto';
import { UpdateAvailabilityDto } from './dtos/update-availability.dto';
import { CreateOverrideDto } from './dtos/create-override.dto';
import { DayOfWeek } from '@prisma/client';
import { AppRole } from '../common/enums/role.enum';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create availability for an employee.
   * Employees can only create their own availability.
   */
  async create(
    employeeId: string,
    companyId: string,
    userId: string,
    userRole: AppRole,
    dto: CreateAvailabilityDto,
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
        throw new ForbiddenException('You can only create availability for yourself');
      }
    }

    // Validate effective dates
    if (dto.effectiveFrom && dto.effectiveTo) {
      const from = new Date(dto.effectiveFrom);
      const to = new Date(dto.effectiveTo);
      if (from > to) {
        throw new BadRequestException('effectiveFrom must be before or equal to effectiveTo');
      }
    }

    // Validate windows
    this.validateWindows(dto.windows);

    // Check if availability already exists
    const existing = await this.prisma.employeeAvailability.findUnique({
      where: {
        employeeId_companyId: {
          employeeId,
          companyId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Availability already exists for this employee. Use update instead.');
    }

    // Create availability with windows in a transaction
    return this.prisma.$transaction(async (tx) => {
      const availability = await tx.employeeAvailability.create({
        data: {
          employeeId,
          companyId,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          createdByUserId: userId,
          windows: {
            create: dto.windows.map((w) => ({
              dayOfWeek: w.dayOfWeek,
              startTime: w.startTime,
              endTime: w.endTime,
            })),
          },
        },
        include: {
          windows: true,
        },
      });

      return availability;
    });
  }

  /**
   * Update availability for an employee.
   * Employees can only update their own availability.
   */
  async update(
    availabilityId: string,
    userId: string,
    userRole: AppRole,
    dto: UpdateAvailabilityDto,
  ) {
    const availability = await this.prisma.employeeAvailability.findUnique({
      where: { id: availabilityId },
      include: {
        employee: true,
      },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    // Verify ownership
    if (userRole === AppRole.EMPLOYEE) {
      const userEmployee = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });

      if (!userEmployee || userEmployee.id !== availability.employeeId) {
        throw new ForbiddenException('You can only update your own availability');
      }
    }

    // Validate effective dates
    if (dto.effectiveFrom && dto.effectiveTo) {
      const from = new Date(dto.effectiveFrom);
      const to = new Date(dto.effectiveTo);
      if (from > to) {
        throw new BadRequestException('effectiveFrom must be before or equal to effectiveTo');
      }
    }

    // Validate windows if provided
    if (dto.windows) {
      this.validateWindows(dto.windows);
    }

    // Update in transaction
    return this.prisma.$transaction(async (tx) => {
      // Delete existing windows if new ones provided
      if (dto.windows) {
        await tx.employeeAvailabilityWindow.deleteMany({
          where: { availabilityId },
        });
      }

      const updated = await tx.employeeAvailability.update({
        where: { id: availabilityId },
        data: {
          effectiveFrom: dto.effectiveFrom !== undefined ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo !== undefined ? new Date(dto.effectiveTo) : undefined,
          updatedByUserId: userId,
          windows: dto.windows
            ? {
                create: dto.windows.map((w) => ({
                  dayOfWeek: w.dayOfWeek,
                  startTime: w.startTime,
                  endTime: w.endTime,
                })),
              }
            : undefined,
        },
        include: {
          windows: true,
        },
      });

      return updated;
    });
  }

  /**
   * Create a temporary override for a specific date.
   * Employees can only create overrides for their own availability.
   */
  async createOverride(
    availabilityId: string,
    userId: string,
    userRole: AppRole,
    dto: CreateOverrideDto,
  ) {
    const availability = await this.prisma.employeeAvailability.findUnique({
      where: { id: availabilityId },
      include: {
        employee: true,
      },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    // Verify ownership
    if (userRole === AppRole.EMPLOYEE) {
      const userEmployee = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });

      if (!userEmployee || userEmployee.id !== availability.employeeId) {
        throw new ForbiddenException('You can only create overrides for your own availability');
      }
    }

    const overrideDate = new Date(dto.overrideDate);
    const now = new Date();

    // Overrides can only apply to future dates
    if (overrideDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      throw new BadRequestException('Overrides can only be created for future dates');
    }

    // Validate time if provided
    if (dto.startTime && dto.endTime) {
      const startMinutes = this.timeStringToMinutes(dto.startTime);
      const endMinutes = this.timeStringToMinutes(dto.endTime);

      if (startMinutes >= endMinutes) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }

    // Check if override already exists for this date
    const existing = await this.prisma.employeeAvailabilityOverride.findUnique({
      where: {
        availabilityId_overrideDate: {
          availabilityId,
          overrideDate,
        },
      },
    });

    if (existing) {
      throw new ConflictException('An override already exists for this date. Update the existing override instead.');
    }

    // Create override
    return this.prisma.employeeAvailabilityOverride.create({
      data: {
        availabilityId,
        overrideDate,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        reason: dto.reason,
        createdByUserId: userId,
      },
    });
  }

  /**
   * Get availability for an employee (read-only for managers/admins).
   */
  async getEmployeeAvailability(employeeId: string, companyId: string) {
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

    const availability = await this.prisma.employeeAvailability.findUnique({
      where: {
        employeeId_companyId: {
          employeeId,
          companyId,
        },
      },
      include: {
        windows: {
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' },
          ],
        },
        overrides: {
          where: {
            overrideDate: {
              gte: new Date(), // Only future overrides
            },
          },
          orderBy: {
            overrideDate: 'asc',
          },
        },
      },
    });

    return availability;
  }

  /**
   * Get availability by ID (for employees to access their own).
   */
  async getById(availabilityId: string, userId: string, userRole: AppRole) {
    const availability = await this.prisma.employeeAvailability.findUnique({
      where: { id: availabilityId },
      include: {
        windows: {
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' },
          ],
        },
        overrides: {
          where: {
            overrideDate: {
              gte: new Date(),
            },
          },
          orderBy: {
            overrideDate: 'asc',
          },
        },
      },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    // Verify ownership for employees
    if (userRole === AppRole.EMPLOYEE) {
      const userEmployee = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });

      if (!userEmployee || userEmployee.id !== availability.employeeId) {
        throw new ForbiddenException('You can only access your own availability');
      }
    }

    return availability;
  }

  /**
   * Validate time windows for overlaps and time ordering.
   */
  private validateWindows(windows: { dayOfWeek: DayOfWeek; startTime: string; endTime: string }[]) {
    // Group by day
    const windowsByDay = new Map<DayOfWeek, typeof windows>();

    for (const window of windows) {
      if (!windowsByDay.has(window.dayOfWeek)) {
        windowsByDay.set(window.dayOfWeek, []);
      }
      windowsByDay.get(window.dayOfWeek)!.push(window);
    }

    // Validate each day's windows
    for (const [day, dayWindows] of windowsByDay.entries()) {
      // Check time ordering
      for (const window of dayWindows) {
        const startMinutes = this.timeStringToMinutes(window.startTime);
        const endMinutes = this.timeStringToMinutes(window.endTime);

        if (startMinutes >= endMinutes) {
          throw new BadRequestException(
            `For ${day}, startTime (${window.startTime}) must be before endTime (${window.endTime})`,
          );
        }
      }

      // Check for overlaps
      for (let i = 0; i < dayWindows.length; i++) {
        for (let j = i + 1; j < dayWindows.length; j++) {
          const w1 = dayWindows[i];
          const w2 = dayWindows[j];

          const w1Start = this.timeStringToMinutes(w1.startTime);
          const w1End = this.timeStringToMinutes(w1.endTime);
          const w2Start = this.timeStringToMinutes(w2.startTime);
          const w2End = this.timeStringToMinutes(w2.endTime);

          // Check if windows overlap: w1Start < w2End && w1End > w2Start
          if (w1Start < w2End && w1End > w2Start) {
            throw new BadRequestException(
              `Overlapping time windows for ${day}: ${w1.startTime}-${w1.endTime} overlaps with ${w2.startTime}-${w2.endTime}`,
            );
          }
        }
      }
    }
  }

  /**
   * Convert time string (HH:mm) to minutes since midnight
   */
  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
