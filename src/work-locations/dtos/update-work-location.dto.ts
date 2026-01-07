import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateWorkLocationDto {
  @ApiPropertyOptional({ example: 'Main Office', description: 'Name of the work location' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '123 Main St, City, State 12345', description: 'Address of the work location' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 40.7128, description: 'Latitude coordinate of the work location' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ example: -74.0060, description: 'Longitude coordinate of the work location' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;
}


