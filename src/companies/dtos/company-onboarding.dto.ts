import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompanyOnboardingDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ example: '10-50', description: 'Estimated number of employees' })
  @IsString()
  @IsNotEmpty()
  estimatedEmployeeRange!: string;

  @ApiProperty({ example: 'Excel Spreadsheets', description: 'Current method used for rostering' })
  @IsString()
  @IsNotEmpty()
  currentRosteringMethod!: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiProperty({ example: 'HR Manager' })
  @IsString()
  @IsNotEmpty()
  jobTitle!: string;
}

