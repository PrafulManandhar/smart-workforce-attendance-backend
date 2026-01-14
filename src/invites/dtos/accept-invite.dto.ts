import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Raw invite token from the invite link',
  })
  @IsString()
  @MinLength(10)
  token!: string;

  @ApiProperty({
    example: 'jane.employee@example.com',
    description: 'Email address of the invited user (must match invitedEmail)',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description:
      'Account password. Minimum 8 characters, must include at least one letter and one number.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;

  @ApiPropertyOptional({
    description: 'Optional phone number for the user',
    example: '+61 400 000 000',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Optional date of birth (ISO 8601 string)',
    example: '1990-05-20',
  })
  @IsString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional({
    description: 'Optional address details (free-form string for now)',
    example: '123 Example Street, Sydney NSW 2000',
  })
  @IsString()
  @IsOptional()
  address?: string;
}

