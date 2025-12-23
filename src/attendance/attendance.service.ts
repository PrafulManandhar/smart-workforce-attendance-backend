import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dtos/check-in.dto';
import { CheckInResponseDto } from './dtos/check-in-response.dto';
import { BreakInDto } from './dtos/break-in.dto';
import { BreakOutDto } from './dtos/break-out.dto';
import { BreakInResponseDto } from './dtos/break-in-response.dto';
import { BreakOutResponseDto } from './dtos/break-out-response.dto';
import { CheckOutDto } from './dtos/check-out.dto';
import { CheckOutResponseDto } from './dtos/check-out-response.dto';
import { calculateDistanceMeters } from '../common/utils/geo';

const MAX_CHECKIN_DISTANCE_METERS = 100;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(userId: string, companyId: string, dto: CheckInDto): Promise<CheckInResponseDto> {
    // Find employee profile for current user and company
    const employeeProfile = await this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!employeeProfile) {
      throw new NotFoundException('Employee profile not found');
    }

    // Fetch company separately to ensure full type information
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Access earlyCheckInMinutes - using type assertion since Prisma types should include this field
    // If IDE still shows error, restart TypeScript server (VS Code: Cmd/Ctrl+Shift+P -> "TypeScript: Restart TS Server")
    const earlyCheckInMinutes = (company as { earlyCheckInMinutes?: number | null }).earlyCheckInMinutes ?? 30;

    // Get current time
    const now = new Date();

    // Calculate early check-in window start time
    const earlyWindowStart = new Date(now.getTime() - earlyCheckInMinutes * 60 * 1000);

    // Find shift that matches "now" with early window
    // Allow check-in if now is between (shift.startAt - earlyWindow) and shift.endAt
    const shift = await this.prisma.shift.findFirst({
      where: {
        employeeId: employeeProfile.id,
        startAt: {
          lte: new Date(now.getTime() + earlyCheckInMinutes * 60 * 1000), // shift.startAt <= now + earlyWindow
        },
        endAt: {
          gte: now, // shift.endAt >= now
        },
      },
      include: {
        workLocation: true,
      },
      orderBy: {
        startAt: 'desc',
      },
    });

    if (!shift) {
      throw new ForbiddenException('No active shift found');
    }

    // Validate GPS coordinates against assigned work location and calculate distance
    let distanceMeters: number | null = null;
    if (shift.workLocation) {
      const workLocation = shift.workLocation;
      
      if (workLocation.latitude !== null && workLocation.longitude !== null) {
        distanceMeters = calculateDistanceMeters(
          dto.latitude,
          dto.longitude,
          workLocation.latitude,
          workLocation.longitude,
        );

        if (distanceMeters > MAX_CHECKIN_DISTANCE_METERS) {
          throw new ForbiddenException(
            `Not at assigned work location. Distance: ${Math.round(distanceMeters)}m (max allowed: ${MAX_CHECKIN_DISTANCE_METERS}m)`,
          );
        }
      }
    }

    // Check if employee already has an active AttendanceSession (actualEndAt is null)
    const activeSession = await this.prisma.attendanceSession.findFirst({
      where: {
        employeeId: employeeProfile.id,
        actualEndAt: null,
      },
    });

    if (activeSession) {
      throw new ConflictException('Employee already has an active attendance session');
    }

    // Determine if this is an early check-in
    const wasEarlyCheckIn = now < shift.startAt;

    // Calculate effective start time: max(now, shift.startAt)
    const effectiveStartAt = new Date(Math.max(now.getTime(), shift.startAt.getTime()));

    // Create AttendanceSession
    const session = await this.prisma.attendanceSession.create({
      data: {
        employeeId: employeeProfile.id,
        shiftId: shift.id,
        actualStartAt: now,
        effectiveStartAt: effectiveStartAt,
        wasEarlyCheckIn,
      },
    });

    // Create AttendanceEvent (CHECK_IN)
    const event = await this.prisma.attendanceEvent.create({
      data: {
        sessionId: session.id,
        type: 'CHECK_IN',
      },
    });

    // Create LocationSnapshot
    await this.prisma.locationSnapshot.create({
      data: {
        eventId: event.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source: 'OFFICE', // Default to OFFICE for now, location validation will be added later
        distanceMeters,
      },
    });

    return {
      sessionId: session.id,
      shiftId: shift.id,
      effectiveStartAt: session.effectiveStartAt,
      actualStartAt: session.actualStartAt,
    };
  }

  /**
   * Validate GPS coordinates against work location and calculate distance
   * Returns distance in meters, or null if no work location or coordinates
   * Throws ForbiddenException if distance exceeds maximum allowed
   */
  private validateLocationAndCalculateDistance(
    latitude: number,
    longitude: number,
    workLocation: { latitude: number | null; longitude: number | null } | null,
  ): number | null {
    if (!workLocation) {
      return null;
    }

    if (workLocation.latitude === null || workLocation.longitude === null) {
      return null;
    }

    const distanceMeters = calculateDistanceMeters(
      latitude,
      longitude,
      workLocation.latitude,
      workLocation.longitude,
    );

    if (distanceMeters > MAX_CHECKIN_DISTANCE_METERS) {
      throw new ForbiddenException(
        `Not at assigned work location. Distance: ${Math.round(distanceMeters)}m (max allowed: ${MAX_CHECKIN_DISTANCE_METERS}m)`,
      );
    }

    return distanceMeters;
  }

  async breakIn(userId: string, companyId: string, dto: BreakInDto): Promise<BreakInResponseDto> {
    // Find employee profile for current user and company
    const employeeProfile = await this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!employeeProfile) {
      throw new NotFoundException('Employee profile not found');
    }

    // Find active attendance session
    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        employeeId: employeeProfile.id,
        actualEndAt: null,
      },
      include: {
        shift: {
          include: {
            workLocation: true,
          },
        },
        events: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new NotFoundException('No active attendance session found');
    }

    if (!session.shift) {
      throw new ForbiddenException('Attendance session is not linked to a shift');
    }

    // Check if last event is already BREAK_IN
    const lastEvent = session.events[0];
    if (lastEvent && lastEvent.type === 'BREAK_IN') {
      throw new BadRequestException('Break-in already recorded. Please break out first.');
    }

    // Validate location against shift work location
    const distanceMeters = this.validateLocationAndCalculateDistance(
      dto.latitude,
      dto.longitude,
      session.shift.workLocation,
    );

    // Create AttendanceEvent (BREAK_IN)
    const event = await this.prisma.attendanceEvent.create({
      data: {
        sessionId: session.id,
        type: 'BREAK_IN',
      },
    });

    // Create LocationSnapshot
    await this.prisma.locationSnapshot.create({
      data: {
        eventId: event.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source: 'OFFICE',
        distanceMeters,
      },
    });

    return {
      eventId: event.id,
      sessionId: session.id,
      createdAt: event.createdAt,
    };
  }

  async breakOut(userId: string, companyId: string, dto: BreakOutDto): Promise<BreakOutResponseDto> {
    // Find employee profile for current user and company
    const employeeProfile = await this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!employeeProfile) {
      throw new NotFoundException('Employee profile not found');
    }

    // Find active attendance session
    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        employeeId: employeeProfile.id,
        actualEndAt: null,
      },
      include: {
        shift: {
          include: {
            workLocation: true,
          },
        },
        events: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new NotFoundException('No active attendance session found');
    }

    if (!session.shift) {
      throw new ForbiddenException('Attendance session is not linked to a shift');
    }

    // Check if last event is BREAK_IN
    const lastEvent = session.events[0];
    if (!lastEvent || lastEvent.type !== 'BREAK_IN') {
      throw new BadRequestException('No active break found. Please break in first.');
    }

    // Validate location against shift work location
    const distanceMeters = this.validateLocationAndCalculateDistance(
      dto.latitude,
      dto.longitude,
      session.shift.workLocation,
    );

    // Create AttendanceEvent (BREAK_OUT)
    const event = await this.prisma.attendanceEvent.create({
      data: {
        sessionId: session.id,
        type: 'BREAK_OUT',
      },
    });

    // Create LocationSnapshot
    await this.prisma.locationSnapshot.create({
      data: {
        eventId: event.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source: 'OFFICE',
        distanceMeters,
      },
    });

    return {
      eventId: event.id,
      sessionId: session.id,
      createdAt: event.createdAt,
    };
  }

  async checkOut(userId: string, companyId: string, dto: CheckOutDto): Promise<CheckOutResponseDto> {
    // Find employee profile for current user and company
    const employeeProfile = await this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (!employeeProfile) {
      throw new NotFoundException('Employee profile not found');
    }

    // Find active attendance session
    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        employeeId: employeeProfile.id,
        actualEndAt: null,
      },
      include: {
        shift: {
          include: {
            workLocation: true,
          },
        },
        events: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('No active attendance session found');
    }

    if (!session.shift) {
      throw new ForbiddenException('Attendance session is not linked to a shift');
    }

    // Load the last AttendanceEvent for break-state validation
    const lastEvent = await this.prisma.attendanceEvent.findFirst({
      where: {
        sessionId: session.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Reject checkout if last event is BREAK_IN
    if (lastEvent && lastEvent.type === 'BREAK_IN') {
      throw new BadRequestException('You must end your break before checking out');
    }

    // Validate location against shift work location
    const distanceMeters = this.validateLocationAndCalculateDistance(
      dto.latitude,
      dto.longitude,
      session.shift.workLocation,
    );

    // Check if summary is required
    if (employeeProfile.isSummaryRequired && (!dto.summary || dto.summary.trim().length === 0)) {
      throw new BadRequestException('Summary is required for this employee');
    }

    // Get current time
    const now = new Date();

    // Calculate actual break minutes from BREAK_IN / BREAK_OUT events
    let actualBreakMinutes = 0;
    let breakInTime: Date | null = null;

    for (const event of session.events) {
      if (event.type === 'BREAK_IN') {
        breakInTime = event.createdAt;
      } else if (event.type === 'BREAK_OUT' && breakInTime) {
        const breakDuration = event.createdAt.getTime() - breakInTime.getTime();
        actualBreakMinutes += Math.round(breakDuration / (1000 * 60));
        breakInTime = null; // Reset for next break pair
      }
    }

    // If there's an unclosed BREAK_IN, calculate up to now
    if (breakInTime) {
      const breakDuration = now.getTime() - breakInTime.getTime();
      actualBreakMinutes += Math.round(breakDuration / (1000 * 60));
    }

    // Read paid and unpaid break minutes from shift
    const assignedPaidBreak = session.shift.paidBreakMinutes ?? 0;
    const assignedUnpaidBreak = session.shift.unpaidBreakMinutes ?? 0;

    // Calculate unpaid deduction: max(assignedUnpaidBreak, max(0, actualBreakMinutes - assignedPaidBreak))
    const unpaidDeduction = Math.max(
      assignedUnpaidBreak,
      Math.max(0, actualBreakMinutes - assignedPaidBreak),
    );

    // Calculate totalWorkedMinutes: (effectiveEndAt - effectiveStartAt) - unpaidDeduction
    const effectiveDuration = now.getTime() - session.effectiveStartAt.getTime();
    const effectiveDurationMinutes = Math.round(effectiveDuration / (1000 * 60));
    const totalWorkedMinutes = effectiveDurationMinutes - unpaidDeduction;

    // Update session with end times, summary, and totalWorkedMinutes
    const updatedSession = await this.prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        actualEndAt: now,
        effectiveEndAt: now,
        totalWorkedMinutes,
        summary: dto.summary?.trim() || null,
      },
    });

    // Create AttendanceEvent (CHECK_OUT)
    const event = await this.prisma.attendanceEvent.create({
      data: {
        sessionId: session.id,
        type: 'CHECK_OUT',
      },
    });

    // Create LocationSnapshot
    await this.prisma.locationSnapshot.create({
      data: {
        eventId: event.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source: 'OFFICE',
        distanceMeters,
      },
    });

    return {
      sessionId: updatedSession.id,
      totalWorkedMinutes: updatedSession.totalWorkedMinutes!,
    };
  }
}

