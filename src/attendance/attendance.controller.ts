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
import { BreakInDto } from './dtos/break-in.dto';
import { BreakOutDto } from './dtos/break-out.dto';
import { BreakInResponseDto } from './dtos/break-in-response.dto';
import { BreakOutResponseDto } from './dtos/break-out-response.dto';

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
  @ApiResponse({ status: 403, description: 'No active shift found, not at assigned work location, or forbidden' })
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

  @Post('break-in')
  @Roles(AppRole.EMPLOYEE)
  @ApiOperation({ summary: 'Start a break during active attendance session' })
  @ApiResponse({ status: 201, description: 'Successfully started break', type: BreakInResponseDto })
  @ApiResponse({ status: 400, description: 'Break-in already recorded or invalid state' })
  @ApiResponse({ status: 403, description: 'Not at assigned work location, session not linked to shift, or forbidden' })
  @ApiResponse({ status: 404, description: 'Employee profile not found or no active attendance session' })
  async breakIn(
    @CurrentUser() user: { userId: string; companyId: string; role: string },
    @Body() dto: BreakInDto,
  ): Promise<BreakInResponseDto> {
    if (!user.companyId) {
      throw new ForbiddenException('User does not belong to a company');
    }

    return this.attendanceService.breakIn(user.userId, user.companyId, dto);
  }

  @Post('break-out')
  @Roles(AppRole.EMPLOYEE)
  @ApiOperation({ summary: 'End a break during active attendance session' })
  @ApiResponse({ status: 201, description: 'Successfully ended break', type: BreakOutResponseDto })
  @ApiResponse({ status: 400, description: 'No active break found or invalid state' })
  @ApiResponse({ status: 403, description: 'Not at assigned work location, session not linked to shift, or forbidden' })
  @ApiResponse({ status: 404, description: 'Employee profile not found or no active attendance session' })
  async breakOut(
    @CurrentUser() user: { userId: string; companyId: string; role: string },
    @Body() dto: BreakOutDto,
  ): Promise<BreakOutResponseDto> {
    if (!user.companyId) {
      throw new ForbiddenException('User does not belong to a company');
    }

    return this.attendanceService.breakOut(user.userId, user.companyId, dto);
  }
}

