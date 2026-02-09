import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../common/email/email.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [CompaniesService, EmailService],
  controllers: [CompaniesController],
})
export class CompaniesModule {}
