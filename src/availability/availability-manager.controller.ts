import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Availability (Manager)')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/employees/:employeeId/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityManagerController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @Roles(AppRole.MANAGER, AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get employee availability (read-only)',
    description:
      'Managers and admins can view employee availability. This is read-only - managers cannot modify employee availability.',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'employeeId', description: 'Employee profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Employee availability retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        employeeId: { type: 'string' },
        companyId: { type: 'string' },
        effectiveFrom: { type: 'string', format: 'date-time', nullable: true },
        effectiveTo: { type: 'string', format: 'date-time', nullable: true },
        windows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              dayOfWeek: { type: 'string', enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] },
              startTime: { type: 'string' },
              endTime: { type: 'string' },
            },
          },
        },
        overrides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              overrideDate: { type: 'string', format: 'date-time' },
              startTime: { type: 'string', nullable: true },
              endTime: { type: 'string', nullable: true },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Employee or availability not found' })
  async getEmployeeAvailability(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.availabilityService.getEmployeeAvailability(employeeId, companyId);
  }
}
