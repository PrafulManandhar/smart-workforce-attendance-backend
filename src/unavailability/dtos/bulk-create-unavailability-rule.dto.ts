import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateUnavailabilityRuleDto } from './create-unavailability-rule.dto';

export class BulkCreateUnavailabilityRuleDto {
  @ApiProperty({
    type: [CreateUnavailabilityRuleDto],
    description: 'Array of unavailability rules to create',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one rule is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateUnavailabilityRuleDto)
  rules!: CreateUnavailabilityRuleDto[];
}
