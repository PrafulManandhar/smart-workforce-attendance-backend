import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateSignupDto {
  @ApiProperty({
    example: 'admin@company.com',
    description: 'Email address for the company admin',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({
    example: 'Acme Inc',
    description: 'Company name',
  })
  @IsString()
  @MinLength(1, { message: 'Company name is required' })
  companyName!: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Password for the admin account (min 8 chars, at least 1 letter, 1 number)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;
}
