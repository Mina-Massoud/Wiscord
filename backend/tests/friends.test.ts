import { describe, expect, test } from 'vitest';

import {
  friendIdParam,
  requestIdParam,
  searchQuery,
  sendRequestBody,
} from '../src/modules/friends/schemas.js';
import { canonicalPair } from '../src/db/models/Friendship.js';

const VALID_OID = '1234567890abcdef12345678';
const OTHER_OID = 'fedcba0987654321fedcba09';

describe('sendRequestBody', () => {
  test('accepts a valid username', () => {
    expect(sendRequestBody.parse({ username: 'mina_42' }).username).toBe('mina_42');
  });

  test('rejects empty username', () => {
    expect(() => sendRequestBody.parse({ username: '' })).toThrow();
  });

  test('rejects too short', () => {
    expect(() => sendRequestBody.parse({ username: 'a' })).toThrow();
  });

  test('rejects too long', () => {
    expect(() =>
      sendRequestBody.parse({ username: 'a'.repeat(33) }),
    ).toThrow();
  });

  test('rejects unsafe characters', () => {
    expect(() => sendRequestBody.parse({ username: 'min<a>' })).toThrow();
    expect(() => sendRequestBody.parse({ username: 'mina!' })).toThrow();
    expect(() => sendRequestBody.parse({ username: 'mina@gmail' })).toThrow();
  });

  test('rejects extra properties', () => {
    expect(() =>
      sendRequestBody.parse({ username: 'mina', sneaky: true }),
    ).toThrow();
  });
});

describe('requestIdParam / friendIdParam', () => {
  test('accept 24-char hex ObjectIds', () => {
    expect(requestIdParam.parse({ id: VALID_OID }).id).toBe(VALID_OID);
    expect(friendIdParam.parse({ userId: VALID_OID }).userId).toBe(VALID_OID);
  });

  test('reject non-hex', () => {
    expect(() => requestIdParam.parse({ id: 'zzz' })).toThrow();
    expect(() => friendIdParam.parse({ userId: 'zzz' })).toThrow();
  });

  test('reject wrong length', () => {
    expect(() => requestIdParam.parse({ id: '1234' })).toThrow();
    expect(() => friendIdParam.parse({ userId: 'a'.repeat(25) })).toThrow();
  });
});

describe('searchQuery', () => {
  test('accepts valid prefix', () => {
    expect(searchQuery.parse({ q: 'mi' }).q).toBe('mi');
  });

  test('rejects single char (need at least 2)', () => {
    expect(() => searchQuery.parse({ q: 'a' })).toThrow();
  });

  test('rejects empty', () => {
    expect(() => searchQuery.parse({ q: '' })).toThrow();
  });

  test('rejects unsafe characters', () => {
    expect(() => searchQuery.parse({ q: 'mi*' })).toThrow();
    expect(() => searchQuery.parse({ q: 'mi.' })).toThrow();
    expect(() => searchQuery.parse({ q: 'mi%' })).toThrow();
  });
});

describe('canonicalPair', () => {
  test('orders the lower id as `a`', () => {
    const result = canonicalPair(OTHER_OID, VALID_OID); // VALID_OID < OTHER_OID
    expect(result.a).toBe(VALID_OID);
    expect(result.b).toBe(OTHER_OID);
  });

  test('returns the same shape regardless of argument order', () => {
    const ab = canonicalPair(VALID_OID, OTHER_OID);
    const ba = canonicalPair(OTHER_OID, VALID_OID);
    expect(ab).toEqual(ba);
  });

  test('handles equal ids deterministically', () => {
    const same = canonicalPair(VALID_OID, VALID_OID);
    expect(same).toEqual({ a: VALID_OID, b: VALID_OID });
  });
});
