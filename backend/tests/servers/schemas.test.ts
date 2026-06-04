import { describe, expect, test } from 'vitest';

import { createChannelBody, createServerBody, serverIdParam } from '../../src/modules/servers/schemas.js';

const VALID_OID = '1234567890abcdef12345678';

describe('createServerBody', () => {
  test('accepts a valid name', () => {
    expect(createServerBody.parse({ name: 'DSA Hub' }).name).toBe('DSA Hub');
  });

  test('accepts optional iconUrl', () => {
    const body = createServerBody.parse({
      name: 'IELTS Prep',
      iconUrl: 'https://cdn.example.com/icon.webp',
    });
    expect(body.iconUrl).toBe('https://cdn.example.com/icon.webp');
  });

  test('rejects too-short name', () => {
    expect(() => createServerBody.parse({ name: 'a' })).toThrow();
  });

  test('rejects extra properties', () => {
    expect(() => createServerBody.parse({ name: 'Hub', sneaky: true })).toThrow();
  });
});

describe('serverIdParam', () => {
  test('accepts 24-char hex ObjectIds', () => {
    expect(serverIdParam.parse({ serverId: VALID_OID }).serverId).toBe(VALID_OID);
  });
});

describe('createChannelBody', () => {
  test('accepts text channel', () => {
    const body = createChannelBody.parse({ name: 'daily-leetcode', type: 'text' });
    expect(body.type).toBe('text');
  });

  test('accepts voice channel', () => {
    expect(createChannelBody.parse({ name: 'focus-room', type: 'voice' }).type).toBe('voice');
  });

  test('rejects invalid name characters', () => {
    expect(() => createChannelBody.parse({ name: 'bad name!', type: 'text' })).toThrow();
  });
});
