import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a 6-digit OTP
   */
  generateOtp(): string {
    // Generate random number between 100000 and 999999
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
  }

  /**
   * Hash OTP using SHA-256
   */
  hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Verify OTP by comparing hash
   */
  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const otpHash = this.hashOtp(otp);

    const otpRecord = await this.prisma.signupOtp.findUnique({
      where: { email },
    });

    if (!otpRecord) {
      return false;
    }

    // Check if expired
    if (otpRecord.expiresAt < new Date()) {
      return false;
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      return false;
    }

    // Compare hashes
    if (otpRecord.otpHash !== otpHash) {
      // Increment attempts
      await this.prisma.signupOtp.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }

    return true;
  }

  /**
   * Create or update OTP record
   * Ensures only one active OTP per email
   */
  async createOrUpdateOtp(
    email: string,
    otpHash: string,
    payload: { companyName: string; passwordHash: string },
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.signupOtp.upsert({
      where: { email },
      create: {
        email,
        otpHash,
        expiresAt,
        attempts: 0,
        payload: payload as any,
      },
      update: {
        otpHash,
        expiresAt,
        attempts: 0, // Reset attempts on new OTP
        payload: payload as any,
      },
    });
  }

  /**
   * Get OTP record by email
   */
  async getOtpRecord(email: string) {
    return this.prisma.signupOtp.findUnique({
      where: { email },
    });
  }

  /**
   * Delete OTP record after successful verification
   */
  async deleteOtp(email: string): Promise<void> {
    await this.prisma.signupOtp.delete({
      where: { email },
    }).catch(() => {
      // Ignore if already deleted
    });
  }

  /**
   * Check if resend is allowed (cooldown >= 60s)
   */
  async canResendOtp(email: string): Promise<boolean> {
    const otpRecord = await this.getOtpRecord(email);
    if (!otpRecord) {
      return true; // No existing OTP, can create new one
    }

    const now = new Date();
    const createdAt = otpRecord.createdAt;
    const cooldownSeconds = (now.getTime() - createdAt.getTime()) / 1000;

    return cooldownSeconds >= 60;
  }
}
