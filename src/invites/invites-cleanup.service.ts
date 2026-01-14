import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteStatus } from '@prisma/client';

@Injectable()
export class InvitesCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvitesCleanupService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Run once on startup
    void this.cleanupExpiredInvites();

    // Then run periodically (every hour)
    this.interval = setInterval(() => {
      void this.cleanupExpiredInvites();
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async cleanupExpiredInvites() {
    try {
      const now = new Date();
      const result = await this.prisma.employeeInvite.updateMany({
        where: {
          status: InviteStatus.PENDING,
          // Use the invite token expiry field from the Prisma model
          tokenExpiresAt: { lt: now },
        },
        data: {
          status: InviteStatus.EXPIRED,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Marked ${result.count} pending invites as EXPIRED`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired invites', error as any);
    }
  }
}

