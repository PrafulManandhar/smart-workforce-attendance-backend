import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLocationDto } from './dtos/create-work-location.dto';

@Injectable()
export class WorkLocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.workLocation.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(companyId: string, createWorkLocationDto: CreateWorkLocationDto) {
    // Verify company exists
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Create work location scoped to the company
    return this.prisma.workLocation.create({
      data: {
        companyId,
        name: createWorkLocationDto.name,
        address: createWorkLocationDto.address,
        latitude: createWorkLocationDto.latitude,
        longitude: createWorkLocationDto.longitude,
      },
    });
  }
}

