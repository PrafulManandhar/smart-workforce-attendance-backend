import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ example: 'abc123def456...', description: 'Invite token from email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'SecurePass123', description: 'Minimum 8 characters, at least 1 number and 1 letter' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
