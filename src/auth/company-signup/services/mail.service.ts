import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize transporter and verify connection on module startup
   */
  async onModuleInit() {
    try {
      const transporter = this.getTransporter();
      // Verify SMTP connection
      const verified = await transporter.verify();
      if (verified) {
        this.logger.log('SMTP connection verified successfully');
      }
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error);
      if (error instanceof Error) {
        this.logger.error(`Verification error details: ${error.message}`);
      }
      this.logger.warn(
        'Email sending may fail. Please check SMTP configuration and network connectivity.',
      );
    }
  }

  /**
   * Get or create nodemailer transporter
   */
  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';

    // Production SMTP configuration
    if (nodeEnv === 'production') {
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpUser = this.configService.get<string>('SMTP_USER');
      const smtpPass = this.configService.get<string>('SMTP_PASS');
      const smtpPort = this.configService.get<number>('SMTP_PORT', 587);

      if (!smtpHost || !smtpUser || !smtpPass) {
        throw new Error('SMTP configuration is required in production environment');
      }

      this.logger.log(`Initializing SMTP transporter for production: ${smtpHost}:${smtpPort}`);

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: this.configService.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: this.configService.get<boolean>(
            'SMTP_TLS_REJECT_UNAUTHORIZED',
            true,
          ),
        },
        // Explicit timeout configurations
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000, // 5 seconds
        socketTimeout: 10000, // 10 seconds
      });
    } else {
      // Local/Development: Mailtrap configuration
      const smtpHost = this.configService.get<string>('SMTP_HOST', 'sandbox.smtp.mailtrap.io');
      const smtpPort = this.configService.get<number>('SMTP_PORT', 2525);
      const smtpUser = this.configService.get<string>('SMTP_USER', '0c366749e2f562');
      const smtpPass = this.configService.get<string>('SMTP_PASS', '21616d661cd17b');

      this.logger.log(`Initializing SMTP transporter for development: ${smtpHost}:${smtpPort}`);

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false, // STARTTLS - explicitly set for Mailtrap
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false, // For local development
        },
        // Explicit timeout configurations for Mailtrap
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000, // 5 seconds
        socketTimeout: 10000, // 10 seconds
      });
    }

    return this.transporter;
  }

  /**
   * Send OTP email for company signup
   */
  async sendOtpEmail(email: string, otp: string): Promise<void> {
    try {
      const transporter = this.getTransporter();
      const from = this.configService.get<string>('SMTP_FROM', 'noreply@example.com');

      this.logger.debug(`Attempting to send OTP email to ${email} from ${from}`);

      const info = await transporter.sendMail({
        from,
        to: email,
        subject: 'Your verification code',
        text: `Your OTP is ${otp}. It expires in 5 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Verification Code</h2>
            <p>Your OTP is: <strong style="font-size: 24px; letter-spacing: 2px;">${otp}</strong></p>
            <p>This code expires in 5 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });

      this.logger.log(`OTP email sent successfully to ${email}. MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      if (error instanceof Error) {
        this.logger.error(`Error details: ${error.message}`);
        if (error.stack) {
          this.logger.debug(`Stack trace: ${error.stack}`);
        }
      }
      throw error;
    }
  }
}
