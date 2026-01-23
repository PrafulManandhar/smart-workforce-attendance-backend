import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UnavailabilityService } from './unavailability.service';
import { UnavailabilityResolverService } from './services/unavailability-resolver.service';
import { CreateUnavailabilityRuleDto } from './dtos/create-unavailability-rule.dto';
import { BulkCreateUnavailabilityRuleDto } from './dtos/bulk-create-unavailability-rule.dto';
import { CreateUnavailabilityExceptionDto } from './dtos/create-unavailability-exception.dto';
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Unavailability')
@ApiBearerAuth('access-token')
@Controller('employee/unavailability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnavailabilityController {
  constructor(
    private readonly unavailabilityService: UnavailabilityService,
    private readonly resolverService: UnavailabilityResolverService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('rules')
  @Roles(AppRole.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a single unavailability rule',
    description:
      'Employees can create recurring unavailability rules for themselves. Rules define weekly patterns (e.g., every Thursday all day, every Friday 16:00-22:00). Rules are expanded into date occurrences when queried.',
  })
  @ApiBody({ type: CreateUnavailabilityRuleDto })
  @ApiResponse({
    status: 201,
    description: 'Unavailability rule created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid timezone, missing times when allDay=false, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'Employee can only create unavailability rules for themselves',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  async createRule(
    @CurrentUser() user: { userId: string; companyId: string; role: AppRole },
    @Body() dto: CreateUnavailabilityRuleDto,
  ) {
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    return this.unavailabilityService.createRule(
      employeeProfile.id,
      user.companyId,
      user.userId,
      user.role,
      dto,
    );
  }

  @Post('rules/bulk')
  @Roles(AppRole.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create multiple unavailability rules in bulk',
    description:
      'Employees can create multiple unavailability rules in a single request. All rules are created in a transaction - if any rule fails validation, the entire operation is rolled back.',
  })
  @ApiBody({ type: BulkCreateUnavailabilityRuleDto })
  @ApiResponse({
    status: 201,
    description: 'All unavailability rules created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid rules, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'Employee can only create unavailability rules for themselves',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  async bulkCreateRules(
    @CurrentUser() user: { userId: string; companyId: string; role: AppRole },
    @Body() bulkDto: BulkCreateUnavailabilityRuleDto,
  ) {
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    return this.unavailabilityService.bulkCreateRules(
      employeeProfile.id,
      user.companyId,
      user.userId,
      user.role,
      bulkDto.rules,
    );
  }

  @Post('exceptions')
  @Roles(AppRole.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a single unavailability exception',
    description:
      'Employees can create date-specific exceptions for holidays, swaps, or special cases. Exceptions override rules: ADD (add extra unavailability), REMOVE (make available despite rule), REPLACE (replace rule window for that date).',
  })
  @ApiBody({ type: CreateUnavailabilityExceptionDto })
  @ApiResponse({
    status: 201,
    description: 'Unavailability exception created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid date, missing times when allDay=false, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'Employee can only create unavailability exceptions for themselves',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  async createException(
    @CurrentUser() user: { userId: string; companyId: string; role: AppRole },
    @Body() dto: CreateUnavailabilityExceptionDto,
  ) {
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!employeeProfile) {
      throw new Error('Employee profile not found for user');
    }

    return this.unavailabilityService.createException(
      employeeProfile.id,
      user.companyId,
      user.userId,
      user.role,
      dto,
    );
  }
}
