import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsDateString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UnavailabilityExceptionType {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
  REPLACE = 'REPLACE',
}

export class CreateUnavailabilityExceptionDto {
  @ApiProperty({
    example: '2026-02-10',
    description: 'Date of the exception (ISO 8601 date string, YYYY-MM-DD)',
  })
  @IsDateString({ strict: true }, { message: 'dateLocal must be a valid date in YYYY-MM-DD format' })
  dateLocal!: string;

  @ApiProperty({
    example: 'Australia/Sydney',
    description: 'Timezone for the exception (e.g., Australia/Sydney, America/New_York)',
  })
  @IsString()
  timezone!: string;

  @ApiProperty({
    enum: UnavailabilityExceptionType,
    description:
      'Type of exception: ADD (add extra unavailability), REMOVE (make available despite rule), REPLACE (replace rule window for that date)',
  })
  @IsEnum(UnavailabilityExceptionType)
  type!: UnavailabilityExceptionType;

  @ApiProperty({
    example: false,
    description: 'If true, employee is unavailable all day. If false, startTimeLocal and endTimeLocal are required.',
  })
  @IsBoolean()
  allDay!: boolean;

  @ApiPropertyOptional({
    example: '10:00',
    description: 'Start time in HH:mm format (24-hour). Required if allDay is false.',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @ValidateIf((o) => !o.allDay)
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTimeLocal must be in HH:mm format (24-hour)',
  })
  startTimeLocal?: string;

  @ApiPropertyOptional({
    example: '14:00',
    description: 'End time in HH:mm format (24-hour). Required if allDay is false. May be earlier than startTimeLocal (overnight allowed).',
    pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
  })
  @ValidateIf((o) => !o.allDay)
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTimeLocal must be in HH:mm format (24-hour)',
  })
  endTimeLocal?: string;

  @ApiPropertyOptional({
    example: 'Holiday',
    description: 'Optional note for the exception',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
