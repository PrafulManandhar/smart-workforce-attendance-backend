import { IsString, IsNotEmpty, IsISO8601, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateShiftDto {
  @ApiProperty({ example: 'clx1234567890', description: 'Employee profile ID' })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiPropertyOptional({ example: 'clx0987654321', description: 'Work location ID' })
  @IsString()
  @IsOptional()
  workLocationId?: string;

  @ApiProperty({ example: '2024-01-15T09:00:00Z', description: 'Shift start time (ISO 8601 date string)' })
  @IsISO8601({ strict: true })
  @IsNotEmpty()
  @Type(() => Date)
  startAt!: Date;

  @ApiProperty({ example: '2024-01-15T17:00:00Z', description: 'Shift end time (ISO 8601 date string)' })
  @IsISO8601({ strict: true })
  @IsNotEmpty()
  @Type(() => Date)
  endAt!: Date;

  @ApiPropertyOptional({ example: 30, description: 'Paid break minutes', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  paidBreakMinutes?: number;

  @ApiPropertyOptional({ example: 60, description: 'Unpaid break minutes', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  unpaidBreakMinutes?: number;

  @ApiPropertyOptional({ example: 'Regular shift with team meeting', description: 'Optional notes about the shift' })
  @IsString()
  @IsOptional()
  notes?: string;
}

