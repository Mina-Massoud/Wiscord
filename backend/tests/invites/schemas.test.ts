import { describe, expect, test } from 'vitest';

import { generateInviteCode } from '../../src/modules/invites/service.js';
import {
  createInviteBody,
  inviteCodeParam,
  serverIdParam,
} from '../../src/modules/invites/schemas.js';

const VALID_OID = '1234567890abcdef12345678';

describe('generateInviteCode', () => {
  test('returns 8 lowercase alphanumeric chars', () => {
    expect(generateInviteCode()).toMatch(/^[a-z2-9]{8}$/);
  });
});

describe('inviteCodeParam', () => {
  test('lowercases invite codes', () => {
    expect(inviteCodeParam.parse({ code: 'AbCdEf12' }).code).toBe('abcdef12');
  });

  test('rejects too-short codes', () => {
    expect(() => inviteCodeParam.parse({ code: 'abc' })).toThrow();
  });
});

describe('serverIdParam', () => {
  test('accepts ObjectIds', () => {
    expect(serverIdParam.parse({ serverId: VALID_OID }).serverId).toBe(VALID_OID);
  });
});

describe('createInviteBody', () => {
  test('accepts empty body for unlimited invite', () => {
    expect(createInviteBody.parse({})).toEqual({});
  });

  test('accepts single-use invite', () => {
    expect(createInviteBody.parse({ maxUses: 1 }).maxUses).toBe(1);
  });

  test('rejects extra properties', () => {
    expect(() => createInviteBody.parse({ maxUses: 1, sneaky: true })).toThrow();
  });
});
