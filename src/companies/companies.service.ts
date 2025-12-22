import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

import { CompanySignupDto } from './dtos/company-signup.dto';
// Type definitions matching schema.prisma - these will be available from @prisma/client after running: npx prisma generate
type CompanyStatusType = 'DRAFT' | 'ACTIVE_TRIAL' | 'ACTIVE_PAID' | 'SUSPENDED';

// Extended Company type that includes all fields from schema.prisma
// TODO: Remove this type and use Prisma.CompanyGetPayload after regenerating Prisma client
type CompanyWithAllFields = {
  id: string;
  name: string | null;
  code: string | null;
  timezone: string;
  isActive: boolean;
  status: CompanyStatusType;
  trialStartAt: Date | null;
  trialEndAt: Date | null;
  employeeLimit: number | null;
  estimatedEmployeeRange: string | null;
  currentRosteringMethod: string | null;
  phoneNumber: string | null;
  jobTitle: string | null;
  onboardingCompletedAt: Date | null;
  annualLeaveRatio: number | null;
  sickLeaveRatio: number | null;
  createdAt: Date;
  updatedAt: Date;
};
import { CompanyOnboardingDto } from './dtos/company-onboarding.dto';
import { CompanyOptOutDto } from './dtos/company-opt-out.dto';
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
          status: 'DRAFT' as CompanyStatusType,
        } as any, // Temporary: Remove after regenerating Prisma client with npx prisma generate
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
        status: 'ACTIVE_TRIAL' as CompanyStatusType,
        trialStartAt: now,
        trialEndAt,
        employeeLimit: 10,
        onboardingCompletedAt: now,
      } as any, // Temporary: Remove after regenerating Prisma client with npx prisma generate
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

    const companyFull = company as unknown as CompanyWithAllFields;

    return {
      id: company.id,
      name: company.name,
      code: company.code,
      timezone: company.timezone,
      status: companyFull.status,
      trialStartAt: companyFull.trialStartAt,
      trialEndAt: companyFull.trialEndAt,
      employeeLimit: companyFull.employeeLimit,
      onboardingCompletedAt: companyFull.onboardingCompletedAt,
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

    const companyFull = company as unknown as CompanyWithAllFields;

    // Check if company has ACTIVE_TRIAL status
    if (companyFull.status !== 'ACTIVE_TRIAL') {
      throw new NotFoundException('Company is not on active trial');
    }

    // Check if trial has expired
    const now = new Date();
    if (companyFull.trialEndAt && companyFull.trialEndAt < now) {
      throw new NotFoundException('Trial period has expired');
    }

    return {
      message: 'Trial access confirmed - Test endpoint working!',
      companyId: company.id,
      companyName: company.name,
      status: companyFull.status,
      trialStartAt: companyFull.trialStartAt,
      trialEndAt: companyFull.trialEndAt,
      employeeLimit: companyFull.employeeLimit,
    };
  }

  async optOut(companyId: string, dto: CompanyOptOutDto) {
    // Check if company exists
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Suspend company and mark inactive
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        status: 'SUSPENDED' as CompanyStatusType,
        isActive: false,
      } as any, // Temporary: Remove after regenerating Prisma client with npx prisma generate
    });

    // TODO: Store feedback in a separate table or logging system if needed
    // For now, feedback is accepted but not persisted in the database

    const companyFull = updatedCompany as unknown as CompanyWithAllFields;

    return {
      message: 'Company has been suspended and marked inactive',
      companyId: updatedCompany.id,
      status: companyFull.status,
      isActive: updatedCompany.isActive,
      feedback: dto.feedback,
    };
  }

  // super admin operations will live here
}
