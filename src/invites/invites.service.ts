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

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
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
}

