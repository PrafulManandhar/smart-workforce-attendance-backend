import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftTodayResponseDto } from './dtos/shift-today-response.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Google Maps URL from latitude and longitude
   */
  private generateMapsUrl(latitude: number, longitude: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  async getTodayShift(userId: string, companyId: string): Promise<ShiftTodayResponseDto | null> {
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

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Find current or next shift for today
    // Priority: 1) Current shift (now is between startAt and endAt)
    //           2) Next shift today (startAt >= now and startAt <= endOfDay)
    // Ensure shift overlaps with today (startAt <= endOfDay AND endAt >= startOfDay)
    const shift = await this.prisma.shift.findFirst({
      where: {
        employeeId: employeeProfile.id,
        startAt: { lte: endOfDay }, // Shift starts on or before end of today
        endAt: { gte: startOfDay }, // Shift ends on or after start of today
        OR: [
          {
            // Current shift: now is between startAt and endAt
            startAt: { lte: now },
            endAt: { gte: now },
          },
          {
            // Next shift today: starts today and hasn't started yet
            startAt: { gte: now },
          },
        ],
      },
      include: {
        workLocation: true,
      },
      orderBy: {
        // Order by startAt ascending to get the earliest matching shift
        // Current shifts will naturally come first (startAt <= now)
        startAt: 'asc',
      },
    });

    if (!shift) {
      return null;
    }

    // Build work location DTO with mapsUrl
    let workLocation: ShiftTodayResponseDto['workLocation'] = null;
    if (shift.workLocation) {
      workLocation = {
        id: shift.workLocation.id,
        name: shift.workLocation.name,
        address: shift.workLocation.address,
        latitude: shift.workLocation.latitude,
        longitude: shift.workLocation.longitude,
        mapsUrl:
          shift.workLocation.latitude !== null && shift.workLocation.longitude !== null
            ? this.generateMapsUrl(shift.workLocation.latitude, shift.workLocation.longitude)
            : null,
      };
    }

    return {
      id: shift.id,
      startAt: shift.startAt,
      endAt: shift.endAt,
      type: shift.type,
      workLocation,
    };
  }
}

