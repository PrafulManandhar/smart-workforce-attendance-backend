import { ApiProperty } from '@nestjs/swagger';

export class BreakInResponseDto {
  @ApiProperty({ example: 'clx123abc456', description: 'ID of the attendance event' })
  eventId!: string;

  @ApiProperty({ example: 'clx789xyz012', description: 'ID of the attendance session' })
  sessionId!: string;

  @ApiProperty({ example: '2024-01-15T12:00:00Z', description: 'Break-in time' })
  createdAt!: Date;
}

