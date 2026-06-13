import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Password hashing with Node's built-in scrypt — no native dependency, same
 * `node:crypto` footing as `tokens.ts`. scrypt is memory-hard, so it resists
 * GPU brute-forcing the way bcrypt/argon2 do.
 *
 * Stored format (single column, self-describing so params can evolve):
 *   scrypt$<N>$<saltHex>$<hashHex>
 *
 * The cost parameter (N) is baked into each hash, so bumping it later only
 * affects new passwords — old hashes still verify against their own N.
 */

// CPU/memory cost. 2^15 = 32768 — OWASP's current floor for scrypt. r/p stay
// at scrypt's defaults (8/1); keylen 64 bytes.
const COST_N = 1 << 15;
const KEY_LEN = 64;
const SALT_BYTES = 16;
// scrypt's working set is ~128 * N * r bytes ≈ 32 MiB at N=32768, r=8 — right
// at OpenSSL's default maxmem ceiling, which makes it throw. Lift the ceiling
// to 64 MiB so the derivation has headroom.
const MAX_MEM = 64 * 1024 * 1024;

// Promisified scrypt that keeps the options overload (promisify() drops it).
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain, salt, KEY_LEN, { N: COST_N, maxmem: MAX_MEM });
  return `scrypt$${COST_N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Constant-time verify. Returns false for any malformed/legacy stored value
 * rather than throwing, so a corrupt row can't crash the sign-in path.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, nStr, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !nStr || !saltHex || !hashHex) return false;

  const n = Number(nStr);
  if (!Number.isInteger(n) || n <= 1) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(plain, salt, expected.length, { N: n, maxmem: MAX_MEM });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
