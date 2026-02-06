import { ApiProperty } from '@nestjs/swagger';

export class VerifyCompanyEmailOtpResponseDto {
  @ApiProperty({
    example: 'Company email verified successfully',
    description: 'Success message',
  })
  message!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token for authentication',
  })
  token!: string;

  @ApiProperty({
    description: 'Company information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'ckvxyz123' },
      name: { type: 'string', nullable: true, example: 'Acme Inc' },
      email: { type: 'string', example: 'admin@example.com' },
      username: { type: 'string', example: 'admin@example.com' },
      status: { type: 'string', example: 'active_trial' },
      created_at: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
    },
  })
  company!: {
    id: string;
    name: string | null;
    email: string;
    username: string;
    status: string;
    created_at: Date;
  };
}
