import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompanySignupDto } from './dtos/company-signup.dto';

@ApiTags('Companies')
@ApiBearerAuth('access-token') 
@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post('signup')
  @Public()
  @ApiOperation({ summary: 'Company signup - Create company and admin user' })
  @ApiResponse({ status: 201, description: 'Company and user created successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  signup(@Body() dto: CompanySignupDto) {
    return this.companiesService.signup(dto);
  }

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
