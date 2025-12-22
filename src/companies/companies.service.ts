import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CompanySignupDto } from './dtos/company-signup.dto';
import { CompanyOnboardingDto } from './dtos/company-onboarding.dto';
import { AppRole } from '../common/enums/role.enum';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  findAll() {
    return this.prisma.company.findMany();
  }

  create(data: { name: string; code: string; timezone?: string }) {
    return this.prisma.company.create({ data });
  }

  async signup(dto: CompanySignupDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create company and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create company with status=DRAFT
      const company = await tx.company.create({
        data: {
          status: 'DRAFT',
        },
      });

      // Create COMPANY_ADMIN user linked to the company
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: AppRole.COMPANY_ADMIN as any,
          companyId: company.id,
          isActive: true,
        },
      });

      return { company, user };
    });

    // Generate tokens using AuthService
    const tokens = await this.authService.issueTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.user.companyId ?? null,
    });

    return {
      ...tokens,
      role: result.user.role,
      companyId: result.company.id,
      userId: result.user.id,
    };
  }

  async onboarding(companyId: string, dto: CompanyOnboardingDto) {
    // Check if company exists
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Calculate trial dates: 21 days from now
    const now = new Date();
    const trialEndAt = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 days in milliseconds

    // Update company with onboarding data and activate trial
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.companyName,
        estimatedEmployeeRange: dto.estimatedEmployeeRange,
        currentRosteringMethod: dto.currentRosteringMethod,
        phoneNumber: dto.phoneNumber,
        jobTitle: dto.jobTitle,
        status: 'ACTIVE_TRIAL',
        trialStartAt: now,
        trialEndAt,
        employeeLimit: 10,
        onboardingCompletedAt: now,
      },
    });

    return updatedCompany;
  }

  async getMyCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      id: company.id,
      name: company.name,
      code: company.code,
      timezone: company.timezone,
      status: (company as any).status,
      trialStartAt: (company as any).trialStartAt,
      trialEndAt: (company as any).trialEndAt,
      employeeLimit: (company as any).employeeLimit,
      onboardingCompletedAt: (company as any).onboardingCompletedAt,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  async testTrialAccess(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Check if company has ACTIVE_TRIAL status
    if ((company as any).status !== 'ACTIVE_TRIAL') {
      throw new NotFoundException('Company is not on active trial');
    }

    // Check if trial has expired
    const now = new Date();
    if ((company as any).trialEndAt && (company as any).trialEndAt < now) {
      throw new NotFoundException('Trial period has expired');
    }

    return {
      message: 'Trial access confirmed - Test endpoint working!',
      companyId: company.id,
      companyName: company.name,
      status: (company as any).status,
      trialStartAt: (company as any).trialStartAt,
      trialEndAt: (company as any).trialEndAt,
      employeeLimit: (company as any).employeeLimit,
    };
  }

  // super admin operations will live here
}
