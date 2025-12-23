import { ApiProperty } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({ example: 'clx123abc456', description: 'ID of the created attendance session' })
  sessionId!: string;

  @ApiProperty({ example: 'clx789xyz012', description: 'ID of the shift for this attendance session' })
  shiftId!: string;

  @ApiProperty({ example: '2024-01-15T09:00:00Z', description: 'Actual check-in time' })
  actualStartAt!: Date;

  @ApiProperty({ example: '2024-01-15T09:00:00Z', description: 'Effective check-in time (after early check-in adjustment)' })
  effectiveStartAt!: Date;

  @ApiProperty({ example: false, description: 'Whether this was an early check-in' })
  wasEarlyCheckIn!: boolean;
}





