import { IsString, IsDateString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUnavailabilityDto {
  @ApiProperty({
    example: '2026-02-10',
    description: 'Date of unavailability (ISO 8601 date string, YYYY-MM-DD)',
  })
  @IsDateString({ strict: true }, { message: 'date must be a valid date in YYYY-MM-DD format' })
  date!: string;

  @ApiPropertyOptional({
    example: '10:00',
    description: 'Start time in HH:mm format (24-hour). If null, employee is unavailable all day.',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (24-hour)',
  })
  startTime?: string;

  @ApiPropertyOptional({
    example: '14:00',
    description: 'End time in HH:mm format (24-hour). If null, employee is unavailable all day.',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  endTime?: string;

  @ApiPropertyOptional({
    example: 'Personal appointment',
    description: 'Optional reason for unavailability',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
