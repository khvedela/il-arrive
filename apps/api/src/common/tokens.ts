import { createHash, randomBytes } from 'crypto';

/** 32 random bytes, base64url (43 chars). The raw value is shown/sent once and never stored. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Deterministic SHA-256 hex digest of a high-entropy random token; this is the only form stored.
 * Deterministic on purpose so the stored value can be looked up by index (salted hashes like argon2
 * are for low-entropy passwords and cannot be used for lookup).
 */
export function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
