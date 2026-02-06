import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCompanyEmailOtpDto {
  @ApiProperty({ example: 'ckvxyz123', description: 'Company ID (cuid)' })
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP sent to company email' })
  @IsString()
  @IsNotEmpty()
  otp!: string;
}

