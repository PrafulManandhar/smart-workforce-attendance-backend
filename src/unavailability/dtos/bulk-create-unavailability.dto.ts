import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateUnavailabilityDto } from './create-unavailability.dto';

export class BulkCreateUnavailabilityDto {
  @ApiProperty({
    type: [CreateUnavailabilityDto],
    description: 'Array of unavailability entries to create',
    example: [
      {
        date: '2026-02-10',
        startTime: '10:00',
        endTime: '14:00',
        reason: 'Personal work',
      },
      {
        date: '2026-02-11',
        reason: 'Medical appointment',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one unavailability entry is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateUnavailabilityDto)
  unavailabilities!: CreateUnavailabilityDto[];
}
