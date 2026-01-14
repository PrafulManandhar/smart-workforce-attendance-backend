import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateEmployeeInviteDto } from './dtos/create-employee-invite.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListInvitesQueryDto } from './dtos/list-invites-query.dto';

@ApiTags('Invites')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List employee invites for a company (admin-only)' })
  @ApiParam({ name: 'companyId', description: 'Company ID whose invites to list' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by invite status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email or name' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (max 100)' })
  listInvites(
    @CurrentUser() user: { userId: string; companyId: string | null; role: AppRole },
    @Param('companyId') companyId: string,
    @Query() query: ListInvitesQueryDto,
  ) {
    // Cast to any to avoid strict typing issues between controller and service
    return (this.invitesService as any).listCompanyInvites(user, companyId, query);
  }

  @Post()
  @Roles(AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an employee invite for a company (admin-only)' })
  @ApiParam({ name: 'companyId', description: 'Company ID for which to create the invite' })
  @ApiResponse({ status: 201, description: 'Invite created successfully' })
  @ApiResponse({ status: 403, description: 'User is not allowed to create invites for this company' })
  @ApiResponse({ status: 409, description: 'Pending invite already exists for this email and company' })
  createEmployeeInvite(
    @CurrentUser() user: { userId: string; companyId: string | null; role: AppRole },
    @Param('companyId') companyId: string,
    @Body() dto: CreateEmployeeInviteDto,
  ) {
    return this.invitesService.createEmployeeInvite(user, companyId, dto);
  }

  @Post(':inviteId/resend')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resend an employee invite email (rotate token)' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'inviteId', description: 'Invite ID' })
  @ApiResponse({ status: 200, description: 'Invite resent successfully' })
  @ApiResponse({ status: 400, description: 'Invite is not pending or has expired' })
  @ApiResponse({ status: 404, description: 'Invite not found for company' })
  resendInvite(
    @CurrentUser() user: { userId: string; companyId: string | null; role: AppRole },
    @Param('companyId') companyId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return (this.invitesService as any).resendInvite(user, companyId, inviteId);
  }

  @Post(':inviteId/revoke')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke an employee invite' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'inviteId', description: 'Invite ID' })
  @ApiResponse({ status: 200, description: 'Invite revoked successfully' })
  @ApiResponse({ status: 400, description: 'Invite cannot be revoked in its current state' })
  @ApiResponse({ status: 404, description: 'Invite not found for company' })
  revokeInvite(
    @CurrentUser() user: { userId: string; companyId: string | null; role: AppRole },
    @Param('companyId') companyId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return (this.invitesService as any).revokeInvite(user, companyId, inviteId);
  }
}

