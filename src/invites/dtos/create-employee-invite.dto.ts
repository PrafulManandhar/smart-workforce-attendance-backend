import { IsEmail, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppRole } from '../../common/enums/role.enum';

export class CreateEmployeeInviteDto {
  @ApiProperty({
    example: 'jane.employee@example.com',
    description: 'Email address of the invited employee',
  })
  @IsEmail()
  invitedEmail!: string;

  @ApiPropertyOptional({
    example: 'Jane Employee',
    description: 'Optional display name of the invited employee',
  })
  @IsString()
  @IsOptional()
  invitedName?: string;

  @ApiPropertyOptional({
    enum: AppRole,
    example: AppRole.EMPLOYEE,
    description: 'Role to assign to the invited user (defaults to EMPLOYEE)',
  })
  @IsEnum(AppRole)
  @IsOptional()
  role?: AppRole;
}

