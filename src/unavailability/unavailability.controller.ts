import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UnavailabilityService } from './unavailability.service';
import { CreateUnavailabilityDto } from './dtos/create-unavailability.dto';
import { BulkCreateUnavailabilityDto } from './dtos/bulk-create-unavailability.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Unavailability')
@ApiBearerAuth('access-token')
@Controller('unavailability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnavailabilityController {
  constructor(
    private readonly unavailabilityService: UnavailabilityService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(AppRole.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a single unavailability entry',
    description:
      'Employees can create unavailability entries for themselves. If startTime and endTime are null, the employee is unavailable for the entire day. If provided, the employee is unavailable only during that time range. Unavailability acts as a hard scheduling constraint.',
  })
  @ApiBody({ type: CreateUnavailabilityDto })
  @ApiResponse({
    status: 201,
    description: 'Unavailability created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        employeeId: { type: 'string' },
        companyId: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
        startTime: { type: 'string', nullable: true, example: '10:00' },
        endTime: { type: 'string', nullable: true, example: '14:00' },
        reason: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid date, startTime >= endTime, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'Employee can only create unavailability for themselves',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Overlapping unavailability already exists for this date',
  })
  async create(
    @CurrentUser() user: { userId: string; companyId: string; role: AppRole },
    @Body() dto: CreateUnavailabilityDto,
  ) {
    // Get employee profile for current user
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    return this.unavailabilityService.create(
      employeeProfile.id,
      user.companyId,
      user.userId,
      user.role,
      dto,
    );
  }

  @Post('bulk')
  @Roles(AppRole.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create multiple unavailability entries in bulk',
    description:
      'Employees can create multiple unavailability entries in a single request. All entries are created in a transaction - if any entry fails validation, the entire operation is rolled back. Duplicate entries in the payload are rejected. Overlapping entries are rejected.',
  })
  @ApiBody({ type: BulkCreateUnavailabilityDto })
  @ApiResponse({
    status: 201,
    description: 'All unavailability entries created successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          employeeId: { type: 'string' },
          companyId: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          startTime: { type: 'string', nullable: true },
          endTime: { type: 'string', nullable: true },
          reason: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error (duplicates in payload, overlapping entries, invalid times, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'Employee can only create unavailability for themselves',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  @ApiResponse({
    status: 409,
    description: 'One or more entries overlap with existing unavailability',
  })
  async bulkCreate(
    @CurrentUser() user: { userId: string; companyId: string; role: AppRole },
    @Body() bulkDto: BulkCreateUnavailabilityDto,
  ) {
    // Get employee profile for current user
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    return this.unavailabilityService.bulkCreate(
      employeeProfile.id,
      user.companyId,
      user.userId,
      user.role,
      bulkDto.unavailabilities,
    );
  }
}
