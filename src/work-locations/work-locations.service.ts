import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLocationDto } from './dtos/create-work-location.dto';
import { UpdateWorkLocationDto } from './dtos/update-work-location.dto';

@Injectable()
export class WorkLocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.workLocation.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneByIdAndCompany(id: string, companyId: string) {
    const workLocation = await this.prisma.workLocation.findFirst({
      where: {
        id,
        companyId,
        isActive: true,
      },
    });

    if (!workLocation) {
      throw new NotFoundException('Work location not found');
    }

    return workLocation;
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

  async update(id: string, companyId: string, updateWorkLocationDto: UpdateWorkLocationDto) {
    // Verify work location exists and belongs to company
    await this.findOneByIdAndCompany(id, companyId);

    // Update work location
    return this.prisma.workLocation.update({
      where: { id },
      data: updateWorkLocationDto,
    });
  }

  async remove(id: string, companyId: string) {
    // Verify work location exists and belongs to company
    await this.findOneByIdAndCompany(id, companyId);

    // Soft delete: set isActive to false
    return this.prisma.workLocation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

