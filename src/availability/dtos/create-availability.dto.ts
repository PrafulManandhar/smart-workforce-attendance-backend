import { IsString, IsOptional, IsDateString, IsArray, ValidateNested, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';

export class AvailabilityWindowDto {
  @ApiProperty({
    enum: DayOfWeek,
    example: DayOfWeek.MONDAY,
    description: 'Day of the week',
  })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({
    example: '09:00',
    description: 'Start time in HH:mm format (24-hour)',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (24-hour)',
  })
  startTime!: string;

  @ApiProperty({
    example: '17:00',
    description: 'End time in HH:mm format (24-hour)',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  endTime!: string;
}

export class CreateAvailabilityDto {
  @ApiProperty({
    type: [AvailabilityWindowDto],
    description: 'Time windows for each day of the week',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  windows!: AvailabilityWindowDto[];

  @ApiPropertyOptional({
    example: '2024-01-01T00:00:00Z',
    description: 'Optional start date when this availability becomes effective',
  })
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    example: '2024-12-31T23:59:59Z',
    description: 'Optional end date when this availability expires',
  })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
