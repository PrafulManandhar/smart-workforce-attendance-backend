import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SignupService } from './signup.service';
import { InitiateSignupDto } from './dtos/initiate-signup.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { ResendOtpDto } from './dtos/resend-otp.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Company Signup')
@Controller('auth/company/signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post('initiate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate company signup',
    description:
      'Step 1 of 2-step signup process. Validates email, generates 6-digit OTP, stores hashed password and company name, sends OTP to email. Does NOT create user or company yet.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - cooldown period not met',
  })
  async initiateSignup(@Body() dto: InitiateSignupDto) {
    return this.signupService.initiateSignup(dto.email, dto.companyName, dto.password);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and complete signup',
    description:
      'Step 2 of 2-step signup process. Validates OTP (checks expiry, attempts), creates Company and Admin User, deletes OTP record, issues JWT access token.',
  })
  @ApiResponse({ status: 200, description: 'Signup successful' })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP, expired OTP, or maximum attempts exceeded',
  })
  @ApiResponse({ status: 404, description: 'OTP not found' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.signupService.verifyOtp(dto.email, dto.otp);
  }

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
