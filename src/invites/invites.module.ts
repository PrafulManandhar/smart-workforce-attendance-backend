import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { PublicInvitesController } from './public-invites.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from '../common/email/email.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvitesController, PublicInvitesController],
  providers: [InvitesService, EmailService],
  exports: [InvitesService, EmailService],
})
export class InvitesModule {}

