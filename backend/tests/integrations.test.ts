import { describe, expect, test, beforeAll } from 'vitest';

import { callbackQuery, providerParam } from '../src/modules/integrations/schemas.js';

// IMPORTANT: env.ts validates env at import time and crashes if JWT_SECRET
// is missing. Tests need a JWT_SECRET set BEFORE importing anything that
// reaches into `lib/env.ts`. We set it here and dynamically import the
// crypto helper after.
beforeAll(() => {
  process.env.JWT_SECRET ??=
    'test-jwt-secret-for-integrations-test-32-chars-min-aaaaaaaaaaaaaaaaaa';
  process.env.MONGODB_URI ??= 'mongodb://localhost:27017/wiscord-test';
});

describe('providerParam', () => {
  test('accepts spotify', () => {
    expect(providerParam.parse({ provider: 'spotify' }).provider).toBe('spotify');
  });

  test('accepts google', () => {
    expect(providerParam.parse({ provider: 'google' }).provider).toBe('google');
  });

  test('rejects unknown providers', () => {
    expect(() => providerParam.parse({ provider: 'apple' })).toThrow();
    expect(() => providerParam.parse({ provider: 'youtube' })).toThrow();
  });
});

describe('callbackQuery', () => {
  test('accepts full callback', () => {
    const parsed = callbackQuery.parse({ code: 'abc', state: 'xyz' });
    expect(parsed.code).toBe('abc');
    expect(parsed.state).toBe('xyz');
    expect(parsed.error).toBeUndefined();
  });

  test('accepts error-only callback (user cancelled)', () => {
    const parsed = callbackQuery.parse({ error: 'access_denied' });
    expect(parsed.error).toBe('access_denied');
    expect(parsed.code).toBeUndefined();
  });

  test('rejects empty strings', () => {
    expect(() => callbackQuery.parse({ code: '', state: 'xyz' })).toThrow();
  });
});

describe('encryptToken / decryptToken', () => {
  test('round-trips a token', async () => {
    const { encryptToken, decryptToken } = await import(
      '../src/lib/crypto/encryptToken.js'
    );
    const plain = 'BQDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const wire = encryptToken(plain);
    expect(wire).not.toContain(plain);
    expect(wire.split('.').length).toBe(3);
    expect(decryptToken(wire)).toBe(plain);
  });

  test('rejects tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await import(
      '../src/lib/crypto/encryptToken.js'
    );
    const wire = encryptToken('hello');
    const parts = wire.split('.');
    // Flip a byte in the ciphertext portion
    const cipherBytes = Buffer.from(parts[2]!, 'base64url');
    cipherBytes[0] = cipherBytes[0]! ^ 0xff;
    const tampered = `${parts[0]}.${parts[1]}.${cipherBytes.toString('base64url')}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  test('rejects malformed wire format', async () => {
    const { decryptToken } = await import('../src/lib/crypto/encryptToken.js');
    expect(() => decryptToken('not-a-real-payload')).toThrow();
    expect(() => decryptToken('only.two')).toThrow();
  });

  test('refuses empty plaintext', async () => {
    const { encryptToken } = await import('../src/lib/crypto/encryptToken.js');
    expect(() => encryptToken('')).toThrow();
  });
});
