import { IsString, IsOptional, IsDateString, IsArray, ValidateNested, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';
import { AvailabilityWindowDto } from './create-availability.dto';

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({
    type: [AvailabilityWindowDto],
    description: 'Time windows for each day of the week',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  @IsOptional()
  windows?: AvailabilityWindowDto[];

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
