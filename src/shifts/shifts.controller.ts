import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateShiftDto } from './dtos/create-shift.dto';

@ApiTags('Shifts')
@ApiBearerAuth('access-token')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

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

