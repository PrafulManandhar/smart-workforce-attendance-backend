import { Controller, Post, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CheckInDto } from './dtos/check-in.dto';
import { CheckInResponseDto } from './dtos/check-in-response.dto';

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check-in')
  @Roles(AppRole.EMPLOYEE)
  @ApiOperation({ summary: 'Check in for attendance' })
  @ApiResponse({ status: 201, description: 'Successfully checked in', type: CheckInResponseDto })
  @ApiResponse({ status: 403, description: 'No active shift found or forbidden' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  @ApiResponse({ status: 409, description: 'Employee already has an active attendance session' })
  async checkIn(
    @CurrentUser() user: { userId: string; companyId: string; role: string },
    @Body() dto: CheckInDto,
  ): Promise<CheckInResponseDto> {
    if (!user.companyId) {
      throw new ForbiddenException('User does not belong to a company');
    }

    return this.attendanceService.checkIn(user.userId, user.companyId, dto);
  }
}

