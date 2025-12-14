import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token received from forgot password flow' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123!' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
