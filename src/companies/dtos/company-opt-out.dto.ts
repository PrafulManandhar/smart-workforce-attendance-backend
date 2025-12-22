import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompanyOptOutDto {
  @ApiProperty({ 
    example: 'The system does not meet our requirements', 
    description: 'Reason for suspending the account (required)' 
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  feedback!: string;
}

