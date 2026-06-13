import { describe, expect, test } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('password hashing', () => {
  test('hash is self-describing scrypt format and not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$32768$')).toBe(true);
    expect(hash).not.toContain('correct horse');
    // scheme$N$salt$hash
    expect(hash.split('$')).toHaveLength(4);
  });

  test('verify accepts the right password', async () => {
    const hash = await hashPassword('s3cret-passw0rd');
    expect(await verifyPassword('s3cret-passw0rd', hash)).toBe(true);
  });

  test('verify rejects the wrong password', async () => {
    const hash = await hashPassword('s3cret-passw0rd');
    expect(await verifyPassword('s3cret-passw0Rd', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  test('same password hashes to different values (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    // …but both still verify
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  test('verify returns false for malformed stored values instead of throwing', async () => {
    for (const bad of ['', 'not-a-hash', 'scrypt$32768$onlythree', 'bcrypt$1$aa$bb', 'scrypt$0$aa$bb']) {
      expect(await verifyPassword('whatever', bad)).toBe(false);
    }
  });
});
