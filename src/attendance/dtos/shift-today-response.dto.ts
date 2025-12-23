import { ApiProperty } from '@nestjs/swagger';

class WorkLocationDto {
  @ApiProperty({ example: 'clx123abc456', description: 'Work location ID' })
  id!: string;

  @ApiProperty({ example: 'Main Office', description: 'Work location name' })
  name!: string;

  @ApiProperty({ example: '123 Main St, Sydney NSW 2000', description: 'Work location address', nullable: true })
  address!: string | null;

  @ApiProperty({ example: -33.8688, description: 'Work location latitude', nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 151.2093, description: 'Work location longitude', nullable: true })
  longitude!: number | null;

  @ApiProperty({ example: 'https://www.google.com/maps/search/?api=1&query=-33.8688,151.2093', description: 'Google Maps URL for the work location', nullable: true })
  mapsUrl!: string | null;
}

export class ShiftTodayResponseDto {
  @ApiProperty({ example: 'clx789xyz012', description: 'Shift ID' })
  id!: string;

  @ApiProperty({ example: '2024-01-15T09:00:00Z', description: 'Shift start time' })
  startAt!: Date;

  @ApiProperty({ example: '2024-01-15T17:00:00Z', description: 'Shift end time' })
  endAt!: Date;

  @ApiProperty({ example: 'DAY', description: 'Shift type', enum: ['MORNING', 'EVENING', 'NIGHT', 'DAY', 'OTHER'] })
  type!: string;

  @ApiProperty({ type: WorkLocationDto, nullable: true, description: 'Work location information' })
  workLocation!: WorkLocationDto | null;
}


