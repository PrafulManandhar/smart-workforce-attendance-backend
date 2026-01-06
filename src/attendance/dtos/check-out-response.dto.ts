import { ApiProperty } from '@nestjs/swagger';

export class CheckOutResponseDto {
  @ApiProperty({ example: 'clx123abc456', description: 'ID of the attendance session' })
  sessionId!: string;

  @ApiProperty({ example: 480, description: 'Total worked minutes (after break deductions)' })
  totalWorkedMinutes!: number;
}




