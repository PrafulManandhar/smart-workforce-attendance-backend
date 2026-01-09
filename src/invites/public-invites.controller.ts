import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AcceptInviteDto } from './dtos/accept-invite.dto';

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

  @Post('accept')
  @Public()
  @ApiOperation({ summary: 'Accept an invite and complete self-onboarding' })
  @ApiBody({ type: AcceptInviteDto })
  @ApiResponse({ status: 200, description: 'Invite accepted and account created / linked' })
  @ApiResponse({ status: 400, description: 'Invalid token, email mismatch, or validation error' })
  @ApiResponse({ status: 410, description: 'Invite token is invalid or expired' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(dto);
  }
}

