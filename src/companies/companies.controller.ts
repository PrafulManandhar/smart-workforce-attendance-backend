import { Body, Controller, Get, Post, UseGuards, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompanySignupDto } from './dtos/company-signup.dto';
import { CompanyOnboardingDto } from './dtos/company-onboarding.dto';
import { CompanyOptOutDto } from './dtos/company-opt-out.dto';

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

  @Post('onboarding')
  @Roles(AppRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Complete company onboarding and activate trial' })
  @ApiResponse({ status: 200, description: 'Company onboarding completed and trial activated successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  onboarding(
    @CurrentUser() user: { companyId: string },
    @Body() dto: CompanyOnboardingDto,
  ) {
    return this.companiesService.onboarding(user.companyId, dto);
  }

  @Get('me')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER, AppRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get current user\'s company information' })
  @ApiResponse({ status: 200, description: 'Company information retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  getMyCompany(@CurrentUser() user: { companyId: string }) {
    if (!user.companyId) {
      throw new NotFoundException('User does not belong to a company');
    }
    return this.companiesService.getMyCompany(user.companyId);
  }

  @Post('opt-out')
  @Roles(AppRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Opt out - Suspend company and mark inactive (requires feedback reason)' })
  @ApiResponse({ status: 200, description: 'Company suspended and marked inactive successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 400, description: 'Invalid feedback provided' })
  optOut(
    @CurrentUser() user: { companyId: string },
    @Body() dto: CompanyOptOutDto,
  ) {
    if (!user.companyId) {
      throw new NotFoundException('User does not belong to a company');
    }
    return this.companiesService.optOut(user.companyId, dto);
  }

  @Get('test-trial')
  @Roles(AppRole.COMPANY_ADMIN, AppRole.MANAGER, AppRole.EMPLOYEE)
  @ApiOperation({ summary: 'Test endpoint - Only accessible for active trial companies (trial not expired)' })
  @ApiResponse({ status: 200, description: 'Trial access confirmed' })
  @ApiResponse({ status: 404, description: 'Company not found or trial expired' })
  testTrialAccess(@CurrentUser() user: { companyId: string }) {
    return this.companiesService.testTrialAccess(user.companyId);
  }
}
