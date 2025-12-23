import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dtos/check-in.dto';
import { CheckInResponseDto } from './dtos/check-in-response.dto';
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
}

