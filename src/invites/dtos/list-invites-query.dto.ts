import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InviteStatus } from '@prisma/client';

export class ListInvitesQueryDto {
  @ApiPropertyOptional({
    enum: InviteStatus,
    description: 'Filter by invite status',
  })
  @IsEnum(InviteStatus)
  @IsOptional()
  status?: InviteStatus;

  @ApiPropertyOptional({
    description: 'Search term for invited email or name (case-insensitive contains)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size (max 100)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

