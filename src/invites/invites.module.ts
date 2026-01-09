import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { PublicInvitesController } from './public-invites.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from '../common/email/email.service';
import { AuthModule } from '../auth/auth.module';
import { InvitesCleanupService } from './invites-cleanup.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InvitesController, PublicInvitesController],
  providers: [InvitesService, EmailService, InvitesCleanupService],
  exports: [InvitesService, EmailService],
})
export class InvitesModule {}

