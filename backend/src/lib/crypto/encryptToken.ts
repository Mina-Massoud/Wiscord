import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../env.js';

/**
 * AES-256-GCM round-trip for integration tokens (Spotify refresh tokens,
 * Google refresh tokens, etc.).
 *
 * Wire format (single string, base64url):
 *   <iv:12 bytes>.<authTag:16 bytes>.<ciphertext:n bytes>
 *
 * Why GCM: integrated authenticated encryption — a flipped bit in the
 * stored ciphertext fails decryption loudly instead of silently returning
 * garbage that we'd then try to use as a token.
 *
 * Key source:
 *   - If INTEGRATION_ENCRYPTION_KEY is set, parse as 32-byte hex.
 *   - Otherwise derive via HKDF from JWT_SECRET so dev works without an
 *     extra env var. Document the cost (rotating JWT_SECRET invalidates
 *     every stored token).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_INFO = Buffer.from('wiscord:integrations:v1');

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  if (env.INTEGRATION_ENCRYPTION_KEY) {
    cachedKey = Buffer.from(env.INTEGRATION_ENCRYPTION_KEY, 'hex');
    if (cachedKey.length !== KEY_BYTES) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
    return cachedKey;
  }

  // Derive a domain-separated key from JWT_SECRET. Same secret used for
  // session signing — but HKDF with a unique `info` byte string ensures
  // these derived keys can't be cross-purposed.
  const derived = hkdfSync(
    'sha256',
    Buffer.from(env.JWT_SECRET, 'utf8'),
    Buffer.alloc(0),
    HKDF_INFO,
    KEY_BYTES,
  );
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error('encryptToken: refusing to encrypt empty plaintext');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString('base64url')).join('.');
}

export function decryptToken(wire: string): string {
  const parts = wire.split('.');
  if (parts.length !== 3) throw new Error('decryptToken: malformed payload');
  const ivB64 = parts[0]!;
  const tagB64 = parts[1]!;
  const cipherB64 = parts[2]!;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(cipherB64, 'base64url');
  if (iv.length !== IV_BYTES) throw new Error('decryptToken: bad iv length');
  if (tag.length !== TAG_BYTES) throw new Error('decryptToken: bad tag length');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Reset the cached key. Test-only escape hatch — never call in app code. */
export function __resetEncryptionKeyForTests(): void {
  cachedKey = null;
}
