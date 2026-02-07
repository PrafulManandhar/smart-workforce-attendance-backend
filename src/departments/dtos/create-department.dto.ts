import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DepartmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Housekeeping', description: 'Name of the department' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Handles room cleaning', description: 'Description of the department' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ 
    example: 'ACTIVE', 
    description: 'Status of the department',
    enum: DepartmentStatus,
    default: DepartmentStatus.ACTIVE
  })
  @IsEnum(DepartmentStatus)
  @IsOptional()
  status?: DepartmentStatus;
}
