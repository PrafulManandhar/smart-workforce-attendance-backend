import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WorkLocationsService } from './work-locations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateWorkLocationDto } from './dtos/create-work-location.dto';

@ApiTags('Work Locations')
@ApiBearerAuth('access-token')
@Controller('work-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkLocationsController {
  constructor(private workLocationsService: WorkLocationsService) {}

  @Get()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'List all work locations for the current company' })
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
}

