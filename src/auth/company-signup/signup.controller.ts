import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SignupService } from './signup.service';
import { ResendOtpDto } from './dtos/resend-otp.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Company Signup')
@Controller('auth/company/signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post('resend-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description:
      'Resends OTP to the email address. Enforces 60-second cooldown to prevent spam.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent to email' })
  @ApiResponse({ status: 404, description: 'No active signup found' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - cooldown period not met',
  })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.signupService.resendOtp(dto.email);
  }
}
