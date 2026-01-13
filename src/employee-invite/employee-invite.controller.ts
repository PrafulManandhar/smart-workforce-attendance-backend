import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EmployeeInviteService } from './employee-invite.service';
import { ValidateInviteQueryDto } from './dto/validate-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Employee Invites')
@Controller('employee-invites')
export class EmployeeInviteController {
  constructor(private readonly employeeInviteService: EmployeeInviteService) {}

  @Get('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate invite token' })
  @ApiQuery({ name: 'token', type: String, description: 'Invite token from email link' })
  @ApiResponse({
    status: 200,
    description: 'Invite is valid',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'employee@example.com' },
        role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER'], example: 'EMPLOYEE' },
        companyName: { type: 'string', example: 'Acme Corp' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({ status: 410, description: 'Invite expired' })
  @ApiResponse({ status: 409, description: 'Invite already accepted' })
  async validateInvite(@Query() query: ValidateInviteQueryDto) {
    return this.employeeInviteService.validateInvite(query.token);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invite and complete onboarding' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding successful, user created',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        role: { type: 'string', example: 'EMPLOYEE' },
        companyId: { type: 'string' },
        userId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid password or validation failed' })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({ status: 410, description: 'Invite expired' })
  @ApiResponse({ status: 409, description: 'Invite already accepted or user exists' })
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.employeeInviteService.acceptInvite(dto);
  }
}
