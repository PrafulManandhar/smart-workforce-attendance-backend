/**
 * Invite Token Utility Module
 * 
 * Framework-agnostic utilities for generating and hashing employee invite tokens.
 * 
 * Security Notes:
 * - Tokens are generated using cryptographically secure random bytes
 * - Only token hashes are stored in the database, never the raw token
 * - Tokens are hashed using SHA-256 before storage
 * 
 * Usage Example:
 * ```typescript
 * import { generateInviteToken, hashInviteToken, getInviteExpiry } from './common/security/invite-token.util';
 * 
 * // Generate a new invite
 * const rawToken = generateInviteToken(); // e.g., "a1b2c3d4e5f6..."
 * const tokenHash = hashInviteToken(rawToken); // SHA-256 hash
 * const expiresAt = getInviteExpiry(7); // 7 days from now
 * 
 * // Store only tokenHash and expiresAt in database
 * await prisma.employeeInvite.create({
 *   data: {
 *     companyId: '...',
 *     invitedEmail: 'employee@example.com',
 *     tokenHash, // ✅ Store hash only
 *     tokenExpiresAt: expiresAt,
 *     // ... other fields
 *   }
 * });
 * 
 * // Send rawToken to user via email (never store it)
 * await emailService.sendInvite({
 *   to: 'employee@example.com',
 *   token: rawToken, // ✅ Send raw token
 * });
 * 
 * // Verify token when user accepts invite
 * const providedToken = '...'; // from user request
 * const providedTokenHash = hashInviteToken(providedToken);
 * const invite = await prisma.employeeInvite.findFirst({
 *   where: {
 *     tokenHash: providedTokenHash,
 *     status: 'PENDING',
 *     tokenExpiresAt: { gt: new Date() }
 *   }
 * });
 * ```
 */

import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random invite token.
 * 
 * Uses 32 random bytes (256 bits) encoded as hexadecimal string.
 * This provides 64 hexadecimal characters, which is sufficient for security.
 * 
 * @returns A secure random token string (64 hex characters)
 * 
 * @example
 * const token = generateInviteToken();
 * // Returns: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
 */
export function generateInviteToken(): string {
  // Generate 32 random bytes (256 bits) and convert to hex string
  // This provides 64 hex characters, which is cryptographically secure
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes an invite token using SHA-256.
 * 
 * This function should be used to hash tokens before storing them in the database.
 * Only the hash should be stored; the raw token should never be persisted.
 * 
 * @param token - The raw invite token to hash
 * @returns The SHA-256 hash of the token as a hexadecimal string
 * 
 * @example
 * const token = generateInviteToken();
 * const hash = hashInviteToken(token);
 * // Store hash in database, send token to user via email
 */
export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculates the expiry date for an invite token.
 * 
 * @param days - Number of days from now until the token expires
 * @returns A Date object representing the expiry time
 * 
 * @example
 * const expiresAt = getInviteExpiry(7); // Expires in 7 days
 * const expiresAt = getInviteExpiry(1); // Expires in 1 day
 */
export function getInviteExpiry(days: number): Date {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setDate(now.getDate() + days);
  return expiryDate;
}
