import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetShiftsQueryDto {
  @ApiProperty({ example: '2024-01-15T00:00:00Z', description: 'Start date (ISO 8601 date string)' })
  @IsISO8601({ strict: true })
  @Type(() => Date)
  from!: Date;

  @ApiProperty({ example: '2024-01-31T23:59:59Z', description: 'End date (ISO 8601 date string)' })
  @IsISO8601({ strict: true })
  @Type(() => Date)
  to!: Date;

  @ApiPropertyOptional({ example: 'clx1234567890', description: 'Filter by employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'clx0987654321', description: 'Filter by work location ID' })
  @IsString()
  @IsOptional()
  workLocationId?: string;
}

