import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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

