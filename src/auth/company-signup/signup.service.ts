import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './services/otp.service';
import { MailService } from './services/mail.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AppRole } from '../../common/enums/role.enum';
import { CompanyStatus } from '@prisma/client';

@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initiate company signup - Step 1
   * Validates email, generates OTP, stores hashed data, sends email
   */
  async initiateSignup(email: string, companyName: string, password: string) {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if there's an active OTP and if resend is allowed
    const existingOtp = await this.otpService.getOtpRecord(normalizedEmail);
    if (existingOtp) {
      const canResend = await this.otpService.canResendOtp(normalizedEmail);
      if (!canResend) {
        throw new HttpException(
          'Please wait at least 60 seconds before requesting a new OTP',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Generate OTP
    const otp = this.otpService.generateOtp();
    const otpHash = this.otpService.hashOtp(otp);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Store OTP with payload
    await this.otpService.createOrUpdateOtp(normalizedEmail, otpHash, {
      companyName,
      passwordHash,
    });

    // Send OTP email
    await this.mailService.sendOtpEmail(normalizedEmail, otp);

    return {
      message: 'OTP sent to your email',
    };
  }

  /**
   * Verify OTP and complete signup - Step 2
   * Validates OTP, creates company and user, issues JWT
   */
  async verifyOtp(email: string, otp: string) {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP
    const isValid = await this.otpService.verifyOtp(normalizedEmail, otp);
    if (!isValid) {
      const otpRecord = await this.otpService.getOtpRecord(normalizedEmail);
      if (!otpRecord) {
        throw new NotFoundException('OTP not found. Please initiate signup again.');
      }
      if (otpRecord.expiresAt < new Date()) {
        throw new BadRequestException('OTP has expired. Please request a new one.');
      }
      if (otpRecord.attempts >= 5) {
        throw new BadRequestException(
          'Maximum attempts exceeded. Please request a new OTP.',
        );
      }
      throw new BadRequestException('Invalid OTP');
    }

    // Get OTP record to retrieve payload
    const otpRecord = await this.otpService.getOtpRecord(normalizedEmail);
    if (!otpRecord) {
      throw new NotFoundException('OTP record not found');
    }

    const payload = otpRecord.payload as { companyName: string; passwordHash: string };

    // Create company and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create company with status=DRAFT
      const company = await tx.company.create({
        data: {
          name: payload.companyName,
          status: CompanyStatus.DRAFT,
        },
      });

      // Create COMPANY_ADMIN user linked to the company
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: payload.passwordHash,
          role: AppRole.COMPANY_ADMIN,
          companyId: company.id,
          isActive: true,
        },
      });

      return { company, user };
    });

    // Delete OTP record
    await this.otpService.deleteOtp(normalizedEmail);

    // Issue JWT access token
    const accessToken = await this.jwtService.signAsync(
      {
        sub: result.user.id,
        email: result.user.email,
        role: result.user.role,
        companyId: result.user.companyId ?? null,
      },
      {
        secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRY', '7d'),
      },
    );

    return {
      message: 'Signup successful',
      accessToken,
    };
  }

  /**
   * Resend OTP
   * Validates cooldown, generates new OTP, sends email
   */
  async resendOtp(email: string) {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if OTP record exists
    const otpRecord = await this.otpService.getOtpRecord(normalizedEmail);
    if (!otpRecord) {
      throw new NotFoundException(
        'No active signup found. Please initiate signup again.',
      );
    }

    // Check cooldown
    const canResend = await this.otpService.canResendOtp(normalizedEmail);
    if (!canResend) {
      throw new HttpException(
        'Please wait at least 60 seconds before requesting a new OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate new OTP
    const otp = this.otpService.generateOtp();
    const otpHash = this.otpService.hashOtp(otp);

    // Update OTP record (payload remains the same)
    await this.otpService.createOrUpdateOtp(normalizedEmail, otpHash, otpRecord.payload as any);

    // Send new OTP email
    await this.mailService.sendOtpEmail(normalizedEmail, otp);

    return {
      message: 'OTP sent to your email',
    };
  }
}
