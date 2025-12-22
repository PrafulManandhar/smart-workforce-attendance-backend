import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth('access-token') 
@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get()
  @Roles(AppRole.SUPER_ADMIN)
  findAll() {
    return this.companiesService.findAll();
  }

  @Post()
  // @Roles(AppRole.SUPER_ADMIN)
  @Roles(AppRole.SUPER_ADMIN, AppRole.COMPANY_ADMIN)
  create(
    @Body()
    body: { name: string; code: string; timezone?: string },
  ) {
    return this.companiesService.create(body);
  }
}
