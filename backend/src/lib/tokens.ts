import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Magic-link tokens: 32 bytes (256 bits) of entropy, url-safe base64.
 * The raw token is what we put in the email. We store ONLY its SHA-256 hash
 * — verifying is hash-and-compare, so a DB leak can't be used to log in.
 */

const TOKEN_BYTES = 32;

function urlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function newMagicLinkToken(): { raw: string; hash: string } {
  const raw = urlSafe(randomBytes(TOKEN_BYTES).toString('base64'));
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Constant-time compare of two hex strings of equal length. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
