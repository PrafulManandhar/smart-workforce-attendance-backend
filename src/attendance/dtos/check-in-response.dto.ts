import { ApiProperty } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({ example: 'clx123abc456', description: 'ID of the created attendance session' })
  sessionId!: string;

  @ApiProperty({ example: 'clx789xyz012', description: 'ID of the shift for this attendance session' })
  shiftId!: string;

  @ApiProperty({ example: '2024-01-15T09:00:00Z', description: 'Effective check-in time (max of actual check-in time and shift start time)' })
  effectiveStartAt!: Date;

  @ApiProperty({ example: '2024-01-15T09:00:00Z', description: 'Actual check-in time' })
  actualStartAt!: Date;
}





