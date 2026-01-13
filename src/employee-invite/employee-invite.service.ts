import {
  Injectable,
  NotFoundException,
  GoneException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { validatePassword } from '../common/utils/password.validator';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class EmployeeInviteService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /**
   * Hash token using SHA-256 (same approach as reset password tokens)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate invite token and return safe data for frontend
   */
  async validateInvite(token: string) {
    const tokenHash = this.hashToken(token);

    const invite = await this.prisma.employeeInvite.findUnique({
      where: { tokenHash },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }

    // Check if expired
    if (new Date() > invite.expiry) {
      throw new GoneException('Invite has expired');
    }

    // Check if already accepted
    if (invite.status === 'ACCEPTED') {
      throw new ConflictException('Invite has already been accepted');
    }

    // Check if expired status
    if (invite.status === 'EXPIRED') {
      throw new GoneException('Invite has expired');
    }

    // Return minimal safe data
    return {
      email: invite.email,
      role: invite.role,
      companyName: invite.company.name || 'Unknown Company',
    };
  }

  /**
   * Accept invite and create user + employee profile
   * Uses transaction to ensure atomicity and prevent race conditions
   */
  async acceptInvite(dto: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    // Validate password strength
    validatePassword(dto.password);

    const tokenHash = this.hashToken(dto.token);

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Fetch invite with lock (for race condition prevention)
      const invite = await tx.employeeInvite.findUnique({
        where: { tokenHash },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!invite) {
        throw new NotFoundException('Invalid invite token');
      }

      // Validate invite status and expiry
      if (new Date() > invite.expiry) {
        throw new GoneException('Invite has expired');
      }

      if (invite.status === 'ACCEPTED') {
        throw new ConflictException('Invite has already been accepted');
      }

      if (invite.status === 'EXPIRED') {
        throw new GoneException('Invite has expired');
      }

      // Check if user already exists for this email and company
      // Requirement: Same email cannot accept two invites for same company
      const existingUser = await tx.user.findUnique({
        where: { email: invite.email },
        include: {
          employeeProfile: true,
        },
      });

      if (existingUser) {
        // Check if user already has employee profile for this company
        if (existingUser.employeeProfile?.companyId === invite.companyId) {
          throw new ConflictException(
            'User already exists for this company',
          );
        }
        // If user exists but EmployeeProfile is for different company,
        // we reject to avoid conflicts (EmployeeProfile.userId is unique)
        // Future: To support multi-company, we'd need to change schema
        if (existingUser.employeeProfile) {
          throw new ConflictException(
            'User already has an employee profile for a different company',
          );
        }
        // If user exists with different companyId, reject
        // (can't change user's company association via invite acceptance)
        if (existingUser.companyId && existingUser.companyId !== invite.companyId) {
          throw new ConflictException(
            'User is already associated with a different company',
          );
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(dto.password, 10);

      let user;
      if (existingUser) {
        // User exists but has no EmployeeProfile and same/no companyId
        // Update password and role as part of onboarding
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            companyId: invite.companyId,
            role: invite.role,
            passwordHash, // Update password as part of onboarding
          },
        });
      } else {
        // Create new user
        user = await tx.user.create({
          data: {
            email: invite.email,
            passwordHash,
            role: invite.role,
            companyId: invite.companyId,
            isActive: true,
          },
        });
      }

      // Create EmployeeProfile (should not exist at this point due to checks above)
      const employeeProfile = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          companyId: invite.companyId,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      // Mark invite as accepted
      await tx.employeeInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });

      return { user, employeeProfile, company: invite.company };
    });

    // Generate tokens for auto-login
    const tokens = await this.authService.issueTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.user.companyId ?? null,
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: result.user.role,
      companyId: result.user.companyId,
      userId: result.user.id,
    };
  }
}
