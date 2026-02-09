import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { OtpService } from './services/otp.service';
import { MailService } from './services/mail.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TOKEN_EXPIRY', '7d'),
        },
      }),
    }),
  ],
  controllers: [SignupController],
  providers: [SignupService, OtpService, MailService],
  exports: [SignupService],
})
export class CompanySignupModule {}
