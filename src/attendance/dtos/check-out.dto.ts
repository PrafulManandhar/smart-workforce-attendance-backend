import { IsNumber, IsNotEmpty, Min, Max, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CheckOutDto {
  @ApiProperty({
    example: -33.8688,
    description: 'Latitude coordinate (-90 to 90)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude must be a number' })
  @IsNotEmpty({ message: 'Latitude is required' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude!: number;

  @ApiProperty({
    example: 151.2093,
    description: 'Longitude coordinate (-180 to 180)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude must be a number' })
  @IsNotEmpty({ message: 'Longitude is required' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude!: number;

  @ApiPropertyOptional({
    example: 'Completed all assigned tasks for the day',
    description: 'Work summary (required if employee.isSummaryRequired is true)',
  })
  @IsString({ message: 'Summary must be a string' })
  @IsOptional()
  summary?: string;
}


