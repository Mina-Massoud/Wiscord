import { describe, expect, test } from 'vitest';

import { CHANNEL_ID_RE, channelIdSchema } from '../src/lib/channel-id.js';

// Real server channels are Mongo ObjectIds; dev-only labs rooms are UUIDs.
const OBJECT_ID = '6a2e65b788bf4ef93573b19f';
const UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('channelIdSchema', () => {
  test('accepts a Mongo ObjectId (real server channel)', () => {
    expect(channelIdSchema.parse(OBJECT_ID)).toBe(OBJECT_ID);
    expect(CHANNEL_ID_RE.test(OBJECT_ID)).toBe(true);
  });

  test('accepts a UUID (dev-only labs room)', () => {
    expect(channelIdSchema.parse(UUID)).toBe(UUID);
    expect(CHANNEL_ID_RE.test(UUID)).toBe(true);
  });

  test('is case-insensitive for the ObjectId hex', () => {
    const upper = OBJECT_ID.toUpperCase();
    expect(channelIdSchema.parse(upper)).toBe(upper);
  });

  test('rejects a garbage string', () => {
    expect(() => channelIdSchema.parse('not-an-id')).toThrow();
    expect(CHANNEL_ID_RE.test('not-an-id')).toBe(false);
  });

  test('rejects an ObjectId of the wrong length', () => {
    expect(() => channelIdSchema.parse(OBJECT_ID.slice(0, 23))).toThrow();
    expect(() => channelIdSchema.parse(OBJECT_ID + 'a')).toThrow();
  });

  test('rejects an empty string', () => {
    expect(() => channelIdSchema.parse('')).toThrow();
  });
});
