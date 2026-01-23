import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { UnavailabilityResolverService } from './services/unavailability-resolver.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Unavailability (Manager)')
@ApiBearerAuth('access-token')
@Controller('employees/:id/unavailability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnavailabilityManagerController {
  constructor(
    private readonly resolverService: UnavailabilityResolverService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(AppRole.MANAGER, AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get unavailability for an employee within a date range',
    description:
      'Managers and admins can view resolved unavailability for any employee. This endpoint expands recurring rules into date occurrences and applies exceptions to return final blocked time windows. No roster creation logic is performed - only unavailability computation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee profile ID',
    type: String,
  })
  @ApiQuery({
    name: 'from',
    description: 'Start date (YYYY-MM-DD)',
    example: '2026-01-01',
    required: true,
  })
  @ApiQuery({
    name: 'to',
    description: 'End date (YYYY-MM-DD)',
    example: '2026-01-31',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Resolved unavailability for the date range',
    schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        companyId: { type: 'string' },
        fromDate: { type: 'string', format: 'date' },
        toDate: { type: 'string', format: 'date' },
        unavailability: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', format: 'date' },
              windows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', format: 'date-time' },
                    end: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid date format, fromDate > toDate, etc.)',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  async getUnavailability(
    @Param('id') employeeId: string,
    @Query('from') fromDate: string,
    @Query('to') toDate: string,
    @CurrentUser() user: { companyId: string },
  ) {
    // Verify employee belongs to company
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: employeeId,
        companyId: user.companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or does not belong to company');
    }

    // Validate date format
    const from = this.parseDate(fromDate);
    const to = this.parseDate(toDate);

    if (from > to) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    // Resolve unavailability
    const resolved = await this.resolverService.resolveUnavailability(employeeId, from, to);

    return {
      employeeId,
      companyId: user.companyId,
      fromDate: from.toISOString().split('T')[0],
      toDate: to.toISOString().split('T')[0],
      unavailability: resolved.map((item) => ({
        date: item.date.toISOString().split('T')[0],
        windows: item.windows.map((window) => ({
          start: window.start.toISOString(),
          end: window.end.toISOString(),
        })),
      })),
    };
  }

  /**
   * Parse date string (YYYY-MM-DD) to Date object.
   */
  private parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
