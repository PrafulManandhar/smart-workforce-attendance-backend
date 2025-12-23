import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ShiftTodayResponseDto } from './dtos/shift-today-response.dto';

@ApiTags('Shifts')
@ApiBearerAuth('access-token')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get('today')
  @Roles(AppRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get employee\'s current or next shift for today' })
  @ApiResponse({
    status: 200,
    description: 'Returns shift if found, or null if no shift exists for today',
    type: ShiftTodayResponseDto,
    schema: {
      nullable: true,
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async getTodayShift(
    @CurrentUser() user: { userId: string; companyId: string; role: string },
  ): Promise<ShiftTodayResponseDto | null> {
    if (!user.companyId) {
      throw new ForbiddenException('User does not belong to a company');
    }

    return this.shiftsService.getTodayShift(user.userId, user.companyId);
  }
}

