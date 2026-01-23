import { IsString, IsDateString, IsOptional, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOverrideDto {
  @ApiProperty({
    example: '2024-01-15',
    description: 'Date this override applies to (ISO 8601 date string)',
  })
  @IsDateString()
  overrideDate!: string;

  @ApiPropertyOptional({
    example: '09:00',
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
    example: '17:00',
    description: 'End time in HH:mm format (24-hour). If null, employee is unavailable all day.',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  endTime?: string;

  @ApiProperty({
    example: 'Medical appointment',
    description: 'Reason for this override (required)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Reason is required for availability overrides' })
  reason!: string;
}
