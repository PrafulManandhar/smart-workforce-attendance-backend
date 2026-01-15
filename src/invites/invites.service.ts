import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
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
import { AcceptEmployeeInviteDto } from './dtos/accept-employee-invite.dto';
import { ListInvitesQueryDto } from './dtos/list-invites-query.dto';
import { UnprocessableEntityException } from '@nestjs/common';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Log audit event (fallback when AuditLog model is not available).
   * In development, logs to console. Can be extended to use a logger service.
   */
  private logAudit(eventName: string, payload: any): void {
    // eslint-disable-next-line no-console
    console.log(`[Audit] ${eventName}`, payload);
  }

  /**
   * List invites for a company with optional filters and pagination.
   */
  async listCompanyInvites(
    currentUser: { userId: string; companyId: string | null; role: AppRole },
    companyIdParam: string,
    query: ListInvitesQueryDto,
  ) {
    const isSuperAdmin = currentUser.role === AppRole.SUPER_ADMIN;
    const isCompanyAdminForCompany =
      currentUser.role === AppRole.COMPANY_ADMIN &&
      currentUser.companyId &&
      currentUser.companyId === companyIdParam;

    if (!isSuperAdmin && !isCompanyAdminForCompany) {
      throw new ForbiddenException('You are not allowed to view invites for this company');
    }

    const { status, search, page = 1, pageSize = 20 } = query;

    const where: any = {
      companyId: companyIdParam,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      const term = search.trim();
      if (term.length > 0) {
        where.OR = [
          { invitedEmail: { contains: term, mode: 'insensitive' } },
          { invitedName: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employeeInvite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.employeeInvite.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

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

    // Enforce company invite/employee cap (employeeLimit)
    const company = await this.prisma.company.findUnique({
      where: { id: companyIdParam },
      select: { employeeLimit: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.employeeLimit != null) {
      const now = new Date();

      const [activeEmployees, pendingInvites] = await this.prisma.$transaction([
        this.prisma.employeeProfile.count({
          where: { companyId: companyIdParam },
        }),
        this.prisma.employeeInvite.count({
          where: {
            companyId: companyIdParam,
            status: InviteStatus.PENDING,
            // Use the invite token expiry field defined in the Prisma model
            tokenExpiresAt: { gt: now },
          },
        }),
      ]);

      if (activeEmployees + pendingInvites >= company.employeeLimit) {
        throw new ConflictException(
          'Employee limit reached for this company. Cannot create more invites.',
        );
      }
    }

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

    // Audit log: invite created
    this.logAudit('INVITE_CREATED', {
      companyId: invite.companyId,
      actorUserId: currentUser.userId,
      inviteId: invite.id,
      invitedEmail: invite.invitedEmail,
      invitedName: invite.invitedName,
      role: invite.role,
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
    const updatedInvite = await this.prisma.employeeInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    // Audit log: invite accepted
    this.logAudit('INVITE_ACCEPTED', {
      companyId: updatedInvite.companyId,
      actorUserId: user.id,
      inviteId: updatedInvite.id,
      invitedEmail: updatedInvite.invitedEmail,
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

  /**
   * Resend an invite email (rotates token and extends expiry).
   */
  async resendInvite(
    currentUser: { userId: string; companyId: string | null; role: AppRole },
    companyIdParam: string,
    inviteId: string,
  ) {
    const isSuperAdmin = currentUser.role === AppRole.SUPER_ADMIN;
    const isCompanyAdminForCompany =
      currentUser.role === AppRole.COMPANY_ADMIN &&
      currentUser.companyId &&
      currentUser.companyId === companyIdParam;

    if (!isSuperAdmin && !isCompanyAdminForCompany) {
      throw new ForbiddenException('You are not allowed to manage invites for this company');
    }

    const invite = await this.prisma.employeeInvite.findFirst({
      where: {
        id: inviteId,
        companyId: companyIdParam,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found for this company');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Only pending invites can be resent');
    }

    const now = new Date();
    if (invite.tokenExpiresAt <= now) {
      throw new BadRequestException('Cannot resend an invite that has already expired');
    }

    // Rotate token and extend expiry
    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = getInviteExpiry(7);

    const updatedInvite = await this.prisma.employeeInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: InviteStatus.PENDING,
      },
    });

    // Audit log: invite resent
    this.logAudit('INVITE_RESENT', {
      companyId: updatedInvite.companyId,
      actorUserId: currentUser.userId,
      inviteId: updatedInvite.id,
      invitedEmail: updatedInvite.invitedEmail,
      previousExpiresAt: invite.tokenExpiresAt,
      newExpiresAt: expiresAt,
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
      await this.emailService.sendEmployeeInviteEmail({
        toEmail: updatedInvite.invitedEmail,
        toName: updatedInvite.invitedName ?? null,
        companyName: null,
        inviteLink,
        expiresAt,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log('[Email Disabled] Employee invite link (resend):', inviteLink);
    }

    return {
      message: 'Invite resent successfully',
      inviteId: updatedInvite.id,
      expiresAt,
      ...(isProd ? {} : { inviteLink }),
    };
  }

  /**
   * Revoke an invite.
   */
  async revokeInvite(
    currentUser: { userId: string; companyId: string | null; role: AppRole },
    companyIdParam: string,
    inviteId: string,
  ) {
    const isSuperAdmin = currentUser.role === AppRole.SUPER_ADMIN;
    const isCompanyAdminForCompany =
      currentUser.role === AppRole.COMPANY_ADMIN &&
      currentUser.companyId &&
      currentUser.companyId === companyIdParam;

    if (!isSuperAdmin && !isCompanyAdminForCompany) {
      throw new ForbiddenException('You are not allowed to manage invites for this company');
    }

    const invite = await this.prisma.employeeInvite.findFirst({
      where: {
        id: inviteId,
        companyId: companyIdParam,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found for this company');
    }

    if (invite.status === InviteStatus.ACCEPTED) {
      throw new BadRequestException('Accepted invites cannot be revoked');
    }

    const revokedInvite = await this.prisma.employeeInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    // Audit log: invite revoked
    this.logAudit('INVITE_REVOKED', {
      companyId: revokedInvite.companyId,
      actorUserId: currentUser.userId,
      inviteId: revokedInvite.id,
      invitedEmail: revokedInvite.invitedEmail,
    });

    return {
      message: 'Invite revoked successfully',
      inviteId: revokedInvite.id,
      status: revokedInvite.status,
      revokedAt: revokedInvite.revokedAt,
    };
  }

  /**
   * Accept an employee invite and complete self-onboarding.
   * 
   * This endpoint:
   * - Validates the invite token (exists, PENDING, not expired)
   * - Checks for duplicate users (same email + companyId)
   * - Creates User with email from invite, password from request
   * - Creates EmployeeProfile with firstName/lastName from request
   * - Marks invite as ACCEPTED
   * - Returns JWT tokens + user + company info
   * 
   * All operations are performed in a single atomic transaction.
   */
  async acceptEmployeeInvite(dto: AcceptEmployeeInviteDto) {
    // Validate password strength (min 8 chars, at least 1 letter, 1 number)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
    if (!passwordRegex.test(dto.password)) {
      throw new UnprocessableEntityException(
        'Password must contain at least one letter and one number',
      );
    }

    if (dto.password.length < 8) {
      throw new UnprocessableEntityException('Password must be at least 8 characters long');
    }

    // Hash the token from request
    const trimmedToken = dto.token.trim();
    if (!trimmedToken) {
      throw new BadRequestException('Token is required');
    }
    const tokenHash = hashInviteToken(trimmedToken);

    const now = new Date();

    // Perform all operations in a single atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1) Load invite from DB and validate
      const invite = await tx.employeeInvite.findFirst({
        where: {
          tokenHash,
        },
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
        throw new NotFoundException('Invalid token');
      }

      // Validate invite status
      if (invite.status !== InviteStatus.PENDING) {
        if (invite.status === InviteStatus.ACCEPTED) {
          throw new ConflictException('Invite has already been accepted');
        }
        if (invite.status === InviteStatus.EXPIRED) {
          throw new GoneException('Invite token has expired');
        }
        if (invite.status === InviteStatus.REVOKED) {
          throw new ForbiddenException('Invite has been revoked');
        }
      }

      // Validate invite not expired
      if (invite.tokenExpiresAt <= now) {
        // Mark as expired if still PENDING
        if (invite.status === InviteStatus.PENDING) {
          await tx.employeeInvite.update({
            where: { id: invite.id },
            data: { status: InviteStatus.EXPIRED },
          });
        }
        throw new GoneException('Invite token has expired');
      }

      // 2) Check user uniqueness: no user exists with same email + companyId
      const existingUser = await tx.user.findUnique({
        where: { email: invite.invitedEmail },
        include: {
          employeeProfile: true,
        },
      });

      if (existingUser) {
        // Check if user already belongs to this company
        if (existingUser.companyId === invite.companyId) {
          throw new ConflictException(
            'A user with this email already exists for this company',
          );
        }
        // If user exists for different company, also conflict
        if (existingUser.companyId) {
          throw new ConflictException(
            'A user with this email already exists for another company',
          );
        }
      }

      // 3) Create new User
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = await tx.user.create({
        data: {
          email: invite.invitedEmail, // Email from invite (not editable)
          passwordHash,
          role: invite.role,
          companyId: invite.companyId,
          isActive: true,
        },
      });

      // 4) Create EmployeeProfile (membership equivalent)
      await tx.employeeProfile.create({
        data: {
          userId: user.id,
          companyId: invite.companyId,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      // 5) Mark invite ACCEPTED
      await tx.employeeInvite.update({
        where: { id: invite.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: now,
        },
      });

      return { user, company: invite.company };
    });

    // 6) Issue JWT tokens
    const tokens = await this.authService.issueTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.user.companyId ?? null,
    });

    // 7) Return response with tokens, user, and company
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
      company: {
        id: result.company.id,
        name: result.company.name,
      },
    };
  }
}

