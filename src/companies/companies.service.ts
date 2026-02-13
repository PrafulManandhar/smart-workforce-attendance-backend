import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
  isOnboardingComplete: boolean;
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
import { EmailService } from '../common/email/email.service';
import { VerifyCompanyEmailOtpDto } from './dtos/verify-company-email-otp.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private emailService: EmailService,
  ) {}

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

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

    // Hash password for later use (user creation is not done here anymore)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    const rawOtp = this.generateOtp();
    const otpHash = await this.hashOtp(rawOtp);

    const { company } = await this.prisma.$transaction(async (tx) => {
      // Create company with status=DRAFT
      const company = await tx.company.create({
        data: {
          status: 'DRAFT' as CompanyStatusType,
        } as any,
      });

      // Store OTP for this company (one active OTP per company)
      await tx.companyEmailOtp.upsert({
        where: { companyId: company.id },
        update: {
          email: dto.email,
          passwordHash,
          otpHash,
          expiresAt,
          attempts: 0,
          verifiedAt: null,
        },
        create: {
          companyId: company.id,
          email: dto.email,
          passwordHash,
          otpHash,
          expiresAt,
        },
      });

      // Persist password hash + other signup payload if needed using SignupOtp or another mechanism.
      // Existing business logic for user creation and token issuance is now deferred
      // until after email verification.

      return { company };
    });

    // Send OTP email (best-effort; failure does not change DB state)
    await this.emailService.sendCompanySignupOtpEmail({
      toEmail: dto.email,
      companyName: null,
      otp: rawOtp,
      expiresAt,
    });

    return {
      message: 'OTP sent to company email',
      companyId: company.id,
    };
  }

  async verifyEmailOtp(dto: VerifyCompanyEmailOtpDto) {
    const now = new Date();

    const otpRecord = await this.prisma.companyEmailOtp.findUnique({
      where: { companyId: dto.companyId },
    });

    if (!otpRecord) {
      throw new NotFoundException('OTP not found for this company');
    }

    if (otpRecord.verifiedAt) {
      throw new BadRequestException('Company email already verified');
    }

    if (otpRecord.attempts >= 5) {
      throw new ForbiddenException('Maximum OTP attempts exceeded');
    }

    if (otpRecord.expiresAt < now) {
      await this.prisma.companyEmailOtp.update({
        where: { companyId: dto.companyId },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('OTP has expired');
    }

    const isMatch = await bcrypt.compare(dto.otp, otpRecord.otpHash);
    if (!isMatch) {
      await this.prisma.companyEmailOtp.update({
        where: { companyId: dto.companyId },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    if (!otpRecord.email || !otpRecord.passwordHash) {
      throw new BadRequestException('Signup data incomplete. Please signup again.');
    }

    // Store non-null values after validation
    const email = otpRecord.email;
    const passwordHash = otpRecord.passwordHash;

    // Verify OTP, create user, activate company, and generate tokens in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark OTP as verified
      await tx.companyEmailOtp.update({
        where: { companyId: dto.companyId },
        data: {
          verifiedAt: now,
          attempts: { increment: 1 },
        },
      });

      // Activate company
      const company = await tx.company.update({
        where: { id: dto.companyId },
        data: {
          status: 'ACTIVE_TRIAL' as CompanyStatusType,
          onboardingCompletedAt: now,
        } as any,
      });

      // Create admin user if it doesn't exist
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: AppRole.COMPANY_ADMIN as any,
            companyId: dto.companyId,
            isActive: true,
          },
        });
      }

      return { company, user };
    });

    // Generate auth tokens using AuthService
    const tokens = await this.authService.issueTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.user.companyId ?? null,
    });

    // Fetch company details
    const companyFull = result.company as unknown as CompanyWithAllFields;

    return {
      message: 'Company email verified successfully',
      token: tokens.accessToken,
      company: {
        id: result.company.id,
        name: result.company.name,
        email: result.user.email,
        username: result.user.email, // Using email as username
        status: companyFull.status.toLowerCase(),
        created_at: result.company.createdAt,
      },
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

    // Update company with onboarding data and activate trial.
    // Mark onboarding as complete only after successful update.
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
        // This flag should only be set to true from the onboarding flow.
        isOnboardingComplete: true,
      } as any, // Temporary: Remove after regenerating Prisma client with npx prisma generate
    });

    return updatedCompany;
  }

  async getMyCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        code: true,
        timezone: true,
        isActive: true,
        status: true,
        trialStartAt: true,
        trialEndAt: true,
        employeeLimit: true,
        onboardingCompletedAt: true,
        // New onboarding completion flag. The Prisma Client types may not yet
        // include this field until you run `npx prisma generate`, so we
        // deliberately allow it here and map it at the response level.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        isOnboardingComplete: true,
        createdAt: true,
        updatedAt: true,
      },
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
       isOnboardingComplete: companyFull.isOnboardingComplete ?? false,
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
