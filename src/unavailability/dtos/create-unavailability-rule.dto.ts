import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum UnavailabilityRuleFrequency {
  WEEKLY = 'WEEKLY',
}

export enum UnavailabilityRuleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateUnavailabilityRuleDto {
  @ApiProperty({
    example: 'Australia/Sydney',
    description: 'Timezone for the rule (e.g., Australia/Sydney, America/New_York)',
  })
  @IsString()
  timezone!: string;

  @ApiProperty({
    enum: UnavailabilityRuleFrequency,
    default: UnavailabilityRuleFrequency.WEEKLY,
    description: 'Frequency of the rule (currently only WEEKLY supported)',
  })
  @IsEnum(UnavailabilityRuleFrequency)
  freq: UnavailabilityRuleFrequency = UnavailabilityRuleFrequency.WEEKLY;

  @ApiProperty({
    example: [4, 7],
    description: 'Array of weekday numbers: 1=Monday, 2=Tuesday, ..., 7=Sunday',
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @Type(() => Number)
  byweekday!: number[];

  @ApiProperty({
    example: false,
    description: 'If true, employee is unavailable all day. If false, startTimeLocal and endTimeLocal are required.',
  })
  @IsBoolean()
  allDay!: boolean;

  @ApiPropertyOptional({
    example: '16:00',
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
    example: '22:00',
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
    example: '2026-01-01',
    description: 'Effective from date (ISO 8601 date string, YYYY-MM-DD). If null, rule applies from creation date.',
  })
  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Effective to date (ISO 8601 date string, YYYY-MM-DD). If null, rule applies indefinitely.',
  })
  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    enum: UnavailabilityRuleStatus,
    default: UnavailabilityRuleStatus.ACTIVE,
    description: 'Status of the rule',
  })
  @IsOptional()
  @IsEnum(UnavailabilityRuleStatus)
  status?: UnavailabilityRuleStatus;

  @ApiPropertyOptional({
    example: 'Weekly unavailable on Thursday and Sunday',
    description: 'Optional note for the rule',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
