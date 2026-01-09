import { IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateShiftDto } from './create-shift.dto';

export class BulkCreateShiftDto {
  @ApiProperty({ 
    type: [CreateShiftDto], 
    description: 'Array of shifts to create',
    example: [
      {
        employeeId: 'clx1234567890',
        workLocationId: 'clx0987654321',
        startAt: '2024-01-15T09:00:00Z',
        endAt: '2024-01-15T17:00:00Z',
        paidBreakMinutes: 30,
        unpaidBreakMinutes: 0,
        type: 'DAY'
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShiftDto)
  shifts!: CreateShiftDto[];
}

