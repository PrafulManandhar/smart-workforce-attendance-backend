import { Controller, Get, Query } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Public Invites')
@Controller('public/invites')
export class PublicInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get('verify')
  @Public()
  @ApiOperation({ summary: 'Public endpoint to verify an invite token' })
  @ApiQuery({ name: 'token', required: true, description: 'Invite token from email link' })
  @ApiResponse({ status: 200, description: 'Invite token is valid' })
  @ApiResponse({ status: 410, description: 'Invite token is invalid or expired' })
  verifyInvite(@Query('token') token: string) {
    return this.invitesService.verifyInviteToken(token);
  }
}

