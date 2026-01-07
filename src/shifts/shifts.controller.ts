import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateShiftDto } from './dtos/create-shift.dto';
import { UpdateShiftDto } from './dtos/update-shift.dto';
import { GetShiftsQueryDto } from './dtos/get-shifts-query.dto';

@ApiTags('Shifts')
@ApiBearerAuth('access-token')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Get shifts for the current company within date range' })
  @ApiResponse({ status: 200, description: 'List of shifts retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query() query: GetShiftsQueryDto,
  ) {
    return this.shiftsService.findAll(
      user.companyId,
      query.from,
      query.to,
      query.employeeId,
      query.workLocationId,
    );
  }

  @Patch(':id')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Update a shift' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @ApiResponse({ status: 200, description: 'Shift updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data or validation failed' })
  @ApiResponse({ status: 404, description: 'Shift, employee, or work location not found' })
  @ApiResponse({ status: 409, description: 'Shift is locked because attendance has started, or overlaps with existing shift' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
    @Body() updateShiftDto: UpdateShiftDto,
  ) {
    return this.shiftsService.update(id, user.companyId, updateShiftDto);
  }

  @Post()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiResponse({ status: 201, description: 'Shift created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data or validation failed' })
  @ApiResponse({ status: 404, description: 'Employee or work location not found' })
  @ApiResponse({ status: 409, description: 'Shift overlaps with existing shift' })
  create(
    @CurrentUser() user: { companyId: string },
    @Body() createShiftDto: CreateShiftDto,
  ) {
    return this.shiftsService.create(user.companyId, createShiftDto);
  }
}

