import { Module } from '@nestjs/common';
import { EmployeeInviteController } from './employee-invite.controller';
import { EmployeeInviteService } from './employee-invite.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EmployeeInviteController],
  providers: [EmployeeInviteService],
  exports: [EmployeeInviteService],
})
export class EmployeeInviteModule {}
