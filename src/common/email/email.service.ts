import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmployeeInviteEmailParams {
  toEmail: string;
  toName?: string | null;
  companyName?: string | null;
  inviteLink: string;
  expiresAt: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Lazily create a nodemailer transport for non-production environments.
   * In production, this returns null so that existing (stub) behaviour
   * remains unchanged until a real provider is configured.
   */
  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';

    // Do not wire Mailtrap in production – keep production behaviour unchanged.
    if (nodeEnv === 'production') {
      return null;
    }

    // Prefer explicit SMTP_* env vars if present.
    const host =
      this.configService.get<string>('SMTP_HOST') ?? 'sandbox.smtp.mailtrap.io';
    const portRaw =
      this.configService.get<string>('SMTP_PORT') ?? '2525';
    const user =
      this.configService.get<string>('SMTP_USER') ?? '0c366749e2f562';
    const pass =
      this.configService.get<string>('SMTP_PASS') ?? '21616d661cd17b';

    const port = Number(portRaw) || 2525;

    // Mailtrap sandbox SMTP configuration for local development.
    // Explicitly set `secure: false` (STARTTLS) and relaxed TLS to
    // avoid connection issues in local/dev environments.
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
      tls: {
        // In local environments certificates can be quirky; do not
        // block the connection because of that.
        rejectUnauthorized: false,
      },
    });

    return this.transporter;
  }

  /**
   * Stub for sending an employee invite email.
   *
   * This method is intentionally simple and framework-friendly. It prepares a
   * plain-text and HTML body that can later be wired up to a real provider
   * (e.g. Nodemailer, SendGrid, SES, etc.).
   */
  async sendEmployeeInviteEmail(params: EmployeeInviteEmailParams): Promise<void> {
    const { toEmail, toName, companyName, inviteLink, expiresAt } = params;

    const displayName = toName ?? 'there';
    const company = companyName ?? 'our platform';

    const subject = `You've been invited to join ${company}`;

    const expiryText = expiresAt.toUTCString();

    const text = [
      `Hi ${displayName},`,
      ``,
      `You've been invited to join ${company}.`,
      ``,
      `To accept the invite and set up your account, open this link:`,
      `${inviteLink}`,
      ``,
      `This invite link will expire on ${expiryText}.`,
      ``,
      `If you didn't expect this invitation, you can safely ignore this email.`,
      ``,
      `Thanks,`,
      `${company} Team`,
    ].join('\n');

    const html = [
      `<p>Hi ${displayName},</p>`,
      `<p>You've been invited to join <strong>${company}</strong>.</p>`,
      `<p>`,
      `  <a href="${inviteLink}" style="display:inline-block;padding:10px 16px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:4px;">`,
      `    Accept your invite`,
      `  </a>`,
      `</p>`,
      `<p>If the button doesn't work, you can also copy and paste this link into your browser:</p>`,
      `<p><a href="${inviteLink}">${inviteLink}</a></p>`,
      `<p>This invite link will expire on <strong>${expiryText}</strong>.</p>`,
      `<p>If you didn't expect this invitation, you can safely ignore this email.</p>`,
      `<p>Thanks,<br/>${company} Team</p>`,
    ].join('\n');

    // Always log a short preview for debugging.
    this.logger.log('[Email] Prepared employee invite email', {
      toEmail,
      subject,
      textPreview: text.slice(0, 160),
    } as any);

    // Attempt to send via Mailtrap / SMTP in non-production environments when configured.
    try {
      const transporter = this.getTransporter();

      // If no transporter (e.g. production), keep existing behaviour: only log.
      if (!transporter) {
        return;
      }

      const fromAddress =
        this.configService.get<string>('EMAIL_FROM') ??
        'Smart Workforce Attendance <no-reply@smart-workforce.local>';

      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text,
        html,
      });

      this.logger.log('[Email] Employee invite email sent successfully', {
        toEmail,
      } as any);
    } catch (err: any) {
      // Do not change business logic on failure – just log the error.
      this.logger.error(
        `Failed to send employee invite email to ${toEmail}`,
        err?.stack ?? String(err),
      );
    }
  }
}

