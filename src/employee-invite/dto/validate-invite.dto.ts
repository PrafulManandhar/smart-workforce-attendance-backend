import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateInviteQueryDto {
  @ApiProperty({ example: 'abc123def456...', description: 'Invite token from email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
