import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateEmployeeInviteDto } from './dtos/create-employee-invite.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Invites')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

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
}

