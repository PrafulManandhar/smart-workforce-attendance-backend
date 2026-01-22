import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dtos/create-availability.dto';
import { UpdateAvailabilityDto } from './dtos/update-availability.dto';
import { CreateOverrideDto } from './dtos/create-override.dto';
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
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Availability')
@ApiBearerAuth('access-token')
@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(AppRole.EMPLOYEE, AppRole.MANAGER, AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create employee availability',
    description:
      'Employees can create their own availability. Managers and admins can create availability for any employee in their company.',
  })
  @ApiBody({ type: CreateAvailabilityDto })
  @ApiResponse({ status: 201, description: 'Availability created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error (overlapping windows, invalid times, etc.)' })
  @ApiResponse({ status: 403, description: 'Employee can only create their own availability' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Availability already exists for this employee' })
  async create(
    @CurrentUser() user: { userId: string; companyId: string; role: AppRole },
    @Body() dto: CreateAvailabilityDto,
  ) {
    // For employees, use their own employee profile
    // For managers/admins, they would need to specify employeeId in body (future enhancement)
    // For now, employees create their own
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    return this.availabilityService.create(
      employeeProfile.id,
      user.companyId,
      user.userId,
      user.role,
      dto,
    );
  }

  @Put(':id')
  @Roles(AppRole.EMPLOYEE, AppRole.MANAGER, AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update employee availability',
    description:
      'Employees can update their own availability. Managers and admins cannot modify employee availability (read-only access).',
  })
  @ApiParam({ name: 'id', description: 'Availability ID' })
  @ApiBody({ type: UpdateAvailabilityDto })
  @ApiResponse({ status: 200, description: 'Availability updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Employee can only update their own availability' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  async update(
    @CurrentUser() user: { userId: string; role: AppRole },
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.availabilityService.update(id, user.userId, user.role, dto);
  }

  @Post('override')
  @Roles(AppRole.EMPLOYEE, AppRole.MANAGER, AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a temporary availability override',
    description:
      'Create a date-specific override that takes precedence over recurring availability. Employees can only create overrides for their own availability. Overrides can only be created for future dates.',
  })
  @ApiBody({ 
    type: CreateOverrideDto,
    description: 'For employees, override is created for their own availability. For managers/admins, availabilityId must be included in body.',
  })
  @ApiResponse({ status: 201, description: 'Override created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or override date is in the past' })
  @ApiResponse({ status: 403, description: 'Employee can only create overrides for their own availability' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  @ApiResponse({ status: 409, description: 'Override already exists for this date' })
  async createOverride(
    @CurrentUser() user: { userId: string; role: AppRole },
    @Body() dto: CreateOverrideDto & { availabilityId?: string },
  ) {
    // For employees, get their availability
    if (user.role === AppRole.EMPLOYEE) {
      const employeeProfile = await this.prisma.employeeProfile.findUnique({
        where: { userId: user.userId },
      });

      if (!employeeProfile) {
        throw new Error('Employee profile not found for user');
      }

      const availability = await this.prisma.employeeAvailability.findUnique({
        where: {
          employeeId_companyId: {
            employeeId: employeeProfile.id,
            companyId: employeeProfile.companyId,
          },
        },
      });

      if (!availability) {
        throw new Error('Availability not found. Please create availability first.');
      }

      return this.availabilityService.createOverride(availability.id, user.userId, user.role, dto);
    }

    // For managers/admins, availabilityId should be in body
    if (!dto.availabilityId) {
      throw new Error('availabilityId is required for managers and admins');
    }

    return this.availabilityService.createOverride(dto.availabilityId, user.userId, user.role, dto);
  }

  @Get('me')
  @Roles(AppRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Get my availability',
    description: 'Get the current user\'s availability (employee only).',
  })
  @ApiResponse({ status: 200, description: 'Availability retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  async getMyAvailability(@CurrentUser() user: { userId: string; companyId: string; role: AppRole }) {
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    const availability = await this.prisma.employeeAvailability.findUnique({
      where: {
        employeeId_companyId: {
          employeeId: employeeProfile.id,
          companyId: user.companyId,
        },
      },
    });

    if (!availability) {
      throw new Error('Availability not found');
    }

    return this.availabilityService.getById(availability.id, user.userId, user.role);
  }
}
