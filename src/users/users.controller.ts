import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('users')
@ApiBearerAuth('access-token')

@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  @Get('me')
  @Roles(AppRole.SUPER_ADMIN, AppRole.COMPANY_ADMIN, AppRole.MANAGER, AppRole.EMPLOYEE)
  getMe(@CurrentUser() user: any) {
    return user;
  }
}
