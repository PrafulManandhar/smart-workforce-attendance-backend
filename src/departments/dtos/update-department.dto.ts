import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentStatus } from './create-department.dto';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Front Desk', description: 'Name of the department' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Reception team', description: 'Description of the department' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ 
    example: 'INACTIVE', 
    description: 'Status of the department',
    enum: DepartmentStatus
  })
  @IsEnum(DepartmentStatus)
  @IsOptional()
  status?: DepartmentStatus;
}
