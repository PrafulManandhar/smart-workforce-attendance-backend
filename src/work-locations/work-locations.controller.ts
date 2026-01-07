import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WorkLocationsService } from './work-locations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateWorkLocationDto } from './dtos/create-work-location.dto';
import { UpdateWorkLocationDto } from './dtos/update-work-location.dto';

@ApiTags('Work Locations')
@ApiBearerAuth('access-token')
@Controller('work-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkLocationsController {
  constructor(private workLocationsService: WorkLocationsService) {}

  @Get()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'List all active work locations for the current company' })
  @ApiResponse({ status: 200, description: 'List of work locations retrieved successfully' })
  findAll(@CurrentUser() user: { companyId: string }) {
    return this.workLocationsService.findAll(user.companyId);
  }

  @Post()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Create a new work location' })
  @ApiResponse({ status: 201, description: 'Work location created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  create(
    @CurrentUser() user: { companyId: string },
    @Body() createWorkLocationDto: CreateWorkLocationDto,
  ) {
    return this.workLocationsService.create(user.companyId, createWorkLocationDto);
  }

  @Patch(':id')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Update a work location' })
  @ApiParam({ name: 'id', description: 'Work location ID' })
  @ApiResponse({ status: 200, description: 'Work location updated successfully' })
  @ApiResponse({ status: 404, description: 'Work location not found or not owned by company' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
    @Body() updateWorkLocationDto: UpdateWorkLocationDto,
  ) {
    return this.workLocationsService.update(id, user.companyId, updateWorkLocationDto);
  }

  @Delete(':id')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Soft delete a work location (sets isActive=false)' })
  @ApiParam({ name: 'id', description: 'Work location ID' })
  @ApiResponse({ status: 200, description: 'Work location soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Work location not found or not owned by company' })
  remove(@Param('id') id: string, @CurrentUser() user: { companyId: string }) {
    return this.workLocationsService.remove(id, user.companyId);
  }
}

