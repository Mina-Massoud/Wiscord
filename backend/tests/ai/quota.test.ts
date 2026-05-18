import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  assertWithinQuota,
  classifyRequestKind,
  getQuotaStatus,
  QUOTAS,
} from '../../src/modules/ai/quota.js';

/**
 * Mock the AiUsageCounter model so we never hit Mongo. The quota
 * surface is the atomic upsert (`findOneAndUpdate`) and the bulk
 * read for status (`find().lean()`). Each test resets the mocks.
 *
 * AiUsageLog stays unmocked — quota no longer reads from it, so
 * importing the real model is a no-op for these tests.
 */
const findOneAndUpdate = vi.fn();
const find = vi.fn();

vi.mock('../../src/db/models/index.js', () => ({
  AiUsageCounter: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    find: (...args: unknown[]) => find(...args),
  },
  // utcDateBucket is pure — inline the same algorithm so the mock
  // matches the real implementation byte-for-byte.
  utcDateBucket: (d: Date = new Date()) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
}));

/**
 * Helper to build the `.lean()` chain the production code uses on
 * the read side: `AiUsageCounter.find({...}).lean() → Promise<rows>`.
 */
function mockFindReturning(rows: Array<{ kind: string; count: number }>): void {
  find.mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) });
}

beforeEach(() => {
  findOneAndUpdate.mockReset();
  find.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('classifyRequestKind', () => {
  test('plain text → message', () => {
    expect(classifyRequestKind('hey what is up')).toBe('message');
    expect(classifyRequestKind('remind me to call mom tomorrow at 4pm')).toBe('message');
  });

  test('contains explicit URL → url_note', () => {
    expect(classifyRequestKind('summarize https://en.wikipedia.org/wiki/Cats')).toBe('url_note');
  });

  test('contains bare domain → url_note', () => {
    expect(classifyRequestKind('explain mina-massoud.com to me')).toBe('url_note');
  });

  test('code-style token like next.js does NOT count', () => {
    expect(classifyRequestKind('how do i use next.js')).toBe('message');
  });
});

describe('assertWithinQuota — atomic reserve', () => {
  test('passes when the upsert returns an incremented counter', async () => {
    // Mongo returned a doc (count below limit, incremented).
    findOneAndUpdate.mockResolvedValue({ count: 1 });
    await expect(
      assertWithinQuota({ userId: 'u1', tier: 'free', kind: 'message' }),
    ).resolves.toBeUndefined();
    // Reservation must use the upsert + filter trick — verify the
    // filter encodes the limit so the atomicity property holds.
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        kind: 'message',
        count: { $lt: QUOTAS.free.message },
      }),
      { $inc: { count: 1 } },
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  test('throws 402 when upsert collides on the unique index (counter at limit)', async () => {
    // E11000 is the canonical Mongo duplicate-key error code. It
    // surfaces here when the filter doesn't match (count already at
    // limit) and the upsert attempts a new insert that the unique
    // compound index blocks.
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    findOneAndUpdate.mockRejectedValue(dupErr);
    await expect(
      assertWithinQuota({ userId: 'u1', tier: 'free', kind: 'message' }),
    ).rejects.toMatchObject({
      status: 402,
      code: 'quota_exceeded',
      details: {
        kind: 'message',
        tier: 'free',
        limit: QUOTAS.free.message,
      },
    });
  });

  test('throws 402 if the upsert returns null (defensive guard)', async () => {
    findOneAndUpdate.mockResolvedValue(null);
    await expect(
      assertWithinQuota({ userId: 'u1', tier: 'free', kind: 'message' }),
    ).rejects.toMatchObject({
      status: 402,
      code: 'quota_exceeded',
    });
  });

  test('pro tier issues the higher message limit in the filter', async () => {
    expect(QUOTAS.pro.message).toBeGreaterThan(QUOTAS.free.message);
    findOneAndUpdate.mockResolvedValue({ count: 1 });
    await assertWithinQuota({ userId: 'u1', tier: 'pro', kind: 'message' });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ count: { $lt: QUOTAS.pro.message } }),
      expect.anything(),
      expect.anything(),
    );
  });

  test('url_note quota is stricter than message quota', async () => {
    expect(QUOTAS.free.url_note).toBeLessThanOrEqual(QUOTAS.free.message);
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    findOneAndUpdate.mockRejectedValue(dupErr);
    await expect(
      assertWithinQuota({ userId: 'u1', tier: 'free', kind: 'url_note' }),
    ).rejects.toMatchObject({
      status: 402,
      code: 'quota_exceeded',
      details: { kind: 'url_note', limit: QUOTAS.free.url_note },
    });
  });

  test('error details include a future resetAt ISO string', async () => {
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    findOneAndUpdate.mockRejectedValue(dupErr);
    try {
      await assertWithinQuota({ userId: 'u1', tier: 'free', kind: 'url_note' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toMatchObject({ code: 'quota_exceeded' });
      const details = (err as { details: { resetAt: string } }).details;
      expect(details.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(details.resetAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  test('non-Mongo errors propagate unchanged (not silently swallowed as 402)', async () => {
    const otherErr = new Error('connection refused');
    findOneAndUpdate.mockRejectedValue(otherErr);
    await expect(
      assertWithinQuota({ userId: 'u1', tier: 'free', kind: 'message' }),
    ).rejects.toThrow('connection refused');
  });

  test('honors the `today` override when supplied', async () => {
    findOneAndUpdate.mockResolvedValue({ count: 1 });
    await assertWithinQuota({
      userId: 'u1',
      tier: 'free',
      kind: 'message',
      today: '2020-01-01',
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2020-01-01' }),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('getQuotaStatus', () => {
  test('returns a status row per quota kind', async () => {
    // Pick "used" counts that always sit strictly under the current
    // cap so the remaining-is-positive assertion holds regardless of
    // how QUOTAS is configured today.
    const messageUsed = Math.max(0, QUOTAS.free.message - 1);
    const urlNoteUsed = Math.max(0, QUOTAS.free.url_note - 1);
    mockFindReturning([
      { kind: 'message', count: messageUsed },
      { kind: 'url_note', count: urlNoteUsed },
    ]);
    const status = await getQuotaStatus({ userId: 'u1', tier: 'free' });
    expect(status).toHaveLength(2);
    const message = status.find((s) => s.kind === 'message');
    const urlNote = status.find((s) => s.kind === 'url_note');
    expect(message).toMatchObject({
      kind: 'message',
      used: messageUsed,
      limit: QUOTAS.free.message,
      remaining: QUOTAS.free.message - messageUsed,
    });
    expect(urlNote).toMatchObject({
      kind: 'url_note',
      used: urlNoteUsed,
      limit: QUOTAS.free.url_note,
      remaining: QUOTAS.free.url_note - urlNoteUsed,
    });
  });

  test('kinds with no counter row report used=0 / remaining=full', async () => {
    mockFindReturning([]);
    const status = await getQuotaStatus({ userId: 'u1', tier: 'pro' });
    expect(status.every((s) => s.used === 0)).toBe(true);
    expect(status.find((s) => s.kind === 'message')?.remaining).toBe(QUOTAS.pro.message);
    expect(status.find((s) => s.kind === 'url_note')?.remaining).toBe(QUOTAS.pro.url_note);
  });

  test('remaining never goes negative even if used > limit (legacy data)', async () => {
    mockFindReturning([{ kind: 'message', count: 9999 }]);
    const status = await getQuotaStatus({ userId: 'u1', tier: 'free' });
    expect(status.find((s) => s.kind === 'message')?.remaining).toBe(0);
  });

  test('honors the `today` override when supplied', async () => {
    mockFindReturning([]);
    await getQuotaStatus({ userId: 'u1', tier: 'free', today: '2020-01-01' });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', date: '2020-01-01' }),
    );
  });
});
