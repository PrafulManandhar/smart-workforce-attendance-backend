import { Injectable, Logger } from '@nestjs/common';

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

    // Stub implementation: log to console / logger for now.
    // Later, integrate with a real email provider here.
    this.logger.log('[Email Stub] Sending employee invite email', {
      toEmail,
      subject,
      textPreview: text.slice(0, 160),
    } as any);

    // For unit/integration tests, it can be helpful to return or expose the
    // prepared payload; for now we just log it.
  }
}

