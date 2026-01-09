import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeInviteDto } from './dtos/create-employee-invite.dto';
import { AppRole } from '../common/enums/role.enum';
import { generateInviteToken, hashInviteToken, getInviteExpiry } from '../common/security/invite-token.util';
import { InviteStatus, Role as PrismaRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/email/email.service';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcryptjs';
import { AcceptInviteDto } from './dtos/accept-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Create an employee invite for a company.
   *
   * - Only company admins (or super admins) can create invites
   * - Email is normalized to lowercase + trimmed
   * - Only one PENDING invite per (companyId, invitedEmail)
   * - Stores only token hash in DB; returns raw token only in DEV via inviteLink
   */
  async createEmployeeInvite(
    currentUser: { userId: string; companyId: string | null; role: AppRole },
    companyIdParam: string,
    dto: CreateEmployeeInviteDto,
  ) {
    // Authorization: user must be company admin for that company, or super admin
    const isSuperAdmin = currentUser.role === AppRole.SUPER_ADMIN;
    const isCompanyAdminForCompany =
      currentUser.role === AppRole.COMPANY_ADMIN &&
      currentUser.companyId &&
      currentUser.companyId === companyIdParam;

    if (!isSuperAdmin && !isCompanyAdminForCompany) {
      throw new ForbiddenException('You are not allowed to create invites for this company');
    }

    // Normalize email
    const normalizedEmail = dto.invitedEmail.trim().toLowerCase();

    // Enforce single pending invite per company + email
    const existingPending = await this.prisma.employeeInvite.findFirst({
      where: {
        companyId: companyIdParam,
        invitedEmail: normalizedEmail,
        status: InviteStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'An active invite already exists for this email and company. Please use the existing invite or revoke it first.',
      );
    }

    // Generate token + hash + expiry
    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = getInviteExpiry(7); // 7 days from now

    const targetRole = (dto.role ?? AppRole.EMPLOYEE) as keyof typeof PrismaRole;

    // Create invite record
    const invite = await this.prisma.employeeInvite.create({
      data: {
        companyId: companyIdParam,
        invitedEmail: normalizedEmail,
        invitedName: dto.invitedName ?? null,
        role: PrismaRole[targetRole],
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: InviteStatus.PENDING,
        createdByUserId: currentUser.userId,
      },
    });

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const frontendBaseUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('APP_BASE_URL') ??
      'http://localhost:3000';

    const inviteLink = `${frontendBaseUrl}/invite/accept?token=${rawToken}`;

    const emailEnabledRaw = this.configService.get<string>('EMAIL_ENABLED') ?? 'false';
    const emailEnabled = emailEnabledRaw.toLowerCase() === 'true';

    if (emailEnabled) {
      // Fire-and-forget for now; in future we might want stronger guarantees / retries
      await this.emailService.sendEmployeeInviteEmail({
        toEmail: normalizedEmail,
        toName: dto.invitedName ?? null,
        companyName: null, // can be populated by joining Company if needed
        inviteLink,
        expiresAt,
      });
    } else {
      // Email disabled: log the invite link for development / debugging.
      // eslint-disable-next-line no-console
      console.log('[Email Disabled] Employee invite link:', inviteLink);
    }

    return {
      message: 'Employee invite created successfully',
      inviteId: invite.id,
      expiresAt,
      // In DEV / non-production, include inviteLink with raw token to simplify testing
      ...(isProd ? {} : { inviteLink }),
    };
  }

  /**
   * Verify a public invite token.
   *
   * - Hashes the provided token and looks up the corresponding invite
   * - Ensures invite is pending and not expired
   * - If expired, marks as EXPIRED and returns 410 Gone
   * - If revoked, returns 403 Forbidden
   */
  async verifyInviteToken(token: string) {
    const trimmed = token?.trim();
    if (!trimmed) {
      throw new BadRequestException('Invite token is required');
    }

    const tokenHash = hashInviteToken(trimmed);

    const invite = await this.prisma.employeeInvite.findFirst({
      where: { tokenHash },
      include: {
        company: {
          select: { name: true },
        },
      },
    });

    if (!invite) {
      // Do not reveal whether token ever existed
      throw new GoneException('Invite token is invalid or has expired');
    }

    // Handle revoked explicitly
    if (invite.status === InviteStatus.REVOKED) {
      throw new ForbiddenException('This invite has been revoked');
    }

    const now = new Date();

    // If pending but past expiry, mark as expired and signal as gone
    if (invite.status === InviteStatus.PENDING && invite.tokenExpiresAt <= now) {
      await this.prisma.employeeInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
      throw new GoneException('Invite token has expired');
    }

    // Already marked as expired or accepted: treat as gone / unusable
    if (invite.status === InviteStatus.EXPIRED || invite.status === InviteStatus.ACCEPTED) {
      throw new GoneException('Invite token is no longer valid');
    }

    return {
      invitedEmail: invite.invitedEmail,
      invitedName: invite.invitedName,
      companyName: invite.company?.name ?? null,
      expiresAt: invite.tokenExpiresAt,
    };
  }

  /**
   * Accept an invite and perform self-onboarding.
   *
   * NOTE: The current data model supports a single company per user (via User.companyId)
   * and a single employee profile per user. Multi-company membership is approximated
   * by ensuring the user either has no company yet, or belongs to the invite's company.
   */
  async acceptInvite(dto: AcceptInviteDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1) Validate and fetch invite (pending, not expired, not revoked)
    const trimmedToken = dto.token.trim();
    const tokenHash = hashInviteToken(trimmedToken);

    const now = new Date();

    const invite = await this.prisma.employeeInvite.findFirst({
      where: {
        tokenHash,
        status: InviteStatus.PENDING,
        tokenExpiresAt: { gt: now },
      },
      include: {
        company: true,
      },
    });

    if (!invite) {
      throw new GoneException('Invite token is invalid or has expired');
    }

    if (invite.status === InviteStatus.REVOKED) {
      throw new ForbiddenException('This invite has been revoked');
    }

    // 2) Email must match invitedEmail exactly after normalization
    if (normalizedEmail !== invite.invitedEmail) {
      throw new BadRequestException('Email does not match the invite');
    }

    // 3) User + profile handling
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let user = existingUser;

    if (user) {
      // If user already belongs to another company, block for now (single-company model)
      if (user.companyId && user.companyId !== invite.companyId) {
        throw new ForbiddenException('This email is already associated with another company');
      }

      // Attach user to company if not yet attached
      if (!user.companyId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            companyId: invite.companyId,
            // Do not override existing role; if user is new and role is generic, they can be upgraded manually
          },
        });
      }

      // Ensure employee profile exists
      const existingProfile = await this.prisma.employeeProfile.findUnique({
        where: { userId: user.id },
      });

      if (!existingProfile) {
        const nameSource = invite.invitedName ?? normalizedEmail;
        const [first, ...rest] = nameSource.split(' ');
        const firstName = first || 'Employee';
        const lastName = rest.join(' ') || firstName;

        await this.prisma.employeeProfile.create({
          data: {
            userId: user.id,
            companyId: invite.companyId,
            firstName,
            lastName,
          },
        });
      }
    } else {
      // New user path
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const nameSource = invite.invitedName ?? normalizedEmail;
      const [first, ...rest] = nameSource.split(' ');
      const firstName = first || 'Employee';
      const lastName = rest.join(' ') || firstName;

      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: invite.role,
          companyId: invite.companyId,
          isActive: true,
        },
      });

      await this.prisma.employeeProfile.create({
        data: {
          userId: user.id,
          companyId: invite.companyId,
          firstName,
          lastName,
        },
      });
    }

    // 4) Mark invite as accepted / single-use
    await this.prisma.employeeInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    // 5) Issue tokens to match existing auth behaviour
    const tokens = await this.authService.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
    });

    return {
      success: true,
      ...tokens,
      role: user.role,
      companyId: user.companyId ?? null,
    };
  }
}

