import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateWorkLocationDto {
  @ApiProperty({ example: 'Main Office', description: 'Name of the work location' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '123 Main St, City, State 12345', description: 'Address of the work location' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: 40.7128, description: 'Latitude coordinate of the work location' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  latitude!: number;

  @ApiProperty({ example: -74.0060, description: 'Longitude coordinate of the work location' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  longitude!: number;
}


