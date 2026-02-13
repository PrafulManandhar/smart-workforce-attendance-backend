import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, DepartmentStatus } from './dtos/create-department.dto';
import { UpdateDepartmentDto } from './dtos/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: departments,
    };
  }

  async findOneByIdAndCompany(id: string, companyId: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async create(companyId: string, createDepartmentDto: CreateDepartmentDto) {
    // Verify company exists
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Check if department name already exists for this company
    const existingDepartment = await this.prisma.department.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: createDepartmentDto.name,
        },
      },
    });

    if (existingDepartment) {
      throw new ConflictException('Department name already exists for this company');
    }

    // Create department scoped to the company
    const department = await this.prisma.department.create({
      data: {
        companyId,
        name: createDepartmentDto.name,
        description: createDepartmentDto.description,
        status: createDepartmentDto.status || DepartmentStatus.ACTIVE,
      },
    });

    return {
      message: 'Department created successfully',
      data: department,
    };
  }

  async update(id: string, companyId: string, updateDepartmentDto: UpdateDepartmentDto) {
    // Verify department exists and belongs to company
    const department = await this.findOneByIdAndCompany(id, companyId);

    // If name is being updated, check uniqueness (ignore current record)
    if (updateDepartmentDto.name && updateDepartmentDto.name !== department.name) {
      const existingDepartment = await this.prisma.department.findUnique({
        where: {
          companyId_name: {
            companyId,
            name: updateDepartmentDto.name,
          },
        },
      });

      if (existingDepartment) {
        throw new ConflictException('Department name already exists for this company');
      }
    }

    // Update department
    const updatedDepartment = await this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
    });

    return {
      message: 'Department updated successfully',
      data: updatedDepartment,
    };
  }

  async remove(id: string, companyId: string) {
    // Verify department exists and belongs to company
    await this.findOneByIdAndCompany(id, companyId);

    // Check if department has shifts assigned
    const shiftCount = await this.prisma.shift.count({
      where: {
        departmentId: id,
      },
    });

    if (shiftCount > 0) {
      throw new BadRequestException('Department has shifts assigned. Reassign shifts first.');
    }

    // Delete department
    await this.prisma.department.delete({
      where: { id },
    });

    return {
      message: 'Department deleted successfully',
    };
  }
}
