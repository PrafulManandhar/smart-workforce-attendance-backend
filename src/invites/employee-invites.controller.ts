import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AcceptEmployeeInviteDto } from './dtos/accept-employee-invite.dto';

@ApiTags('Employee Invites')
@Controller('employee-invites')
export class EmployeeInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept employee invite and complete self-onboarding' })
  @ApiBody({ type: AcceptEmployeeInviteDto })
  @ApiResponse({
    status: 200,
    description: 'Invite accepted successfully, user account created',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx123abc456' },
            email: { type: 'string', example: 'employee@example.com' },
            role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER'], example: 'EMPLOYEE' },
          },
        },
        company: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx789xyz012' },
            name: { type: 'string', example: 'Acme Corporation' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({ status: 410, description: 'Expired token' })
  @ApiResponse({ status: 409, description: 'Already accepted or user exists' })
  @ApiResponse({ status: 422, description: 'Validation failure (password, firstName, lastName)' })
  async acceptInvite(@Body() dto: AcceptEmployeeInviteDto) {
    return this.invitesService.acceptEmployeeInvite(dto);
  }
}
