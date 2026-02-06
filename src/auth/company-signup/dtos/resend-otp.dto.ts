import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({
    example: 'admin@company.com',
    description: 'Email address used during signup initiation',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;
}
