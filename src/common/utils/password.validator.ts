import { BadRequestException } from '@nestjs/common';

/**
 * Validates password strength according to requirements:
 * - Minimum 8 characters
 * - At least 1 number
 * - At least 1 letter
 */
export function validatePassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw new BadRequestException('Password is required');
  }

  if (password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters long');
  }

  const hasNumber = /\d/.test(password);
  if (!hasNumber) {
    throw new BadRequestException('Password must contain at least one number');
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  if (!hasLetter) {
    throw new BadRequestException('Password must contain at least one letter');
  }
}
