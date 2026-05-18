import { describe, expect, test, vi, beforeEach } from 'vitest';

import { computeBillingMetrics } from '../../src/modules/admin/billing-metrics.js';

/**
 * Smoke tests for the admin metrics aggregation. We mock both
 * `User` and `AiUsageLog` so we don't need a live Mongo — the
 * aggregations themselves are trusted (driver-level) and the
 * mapping logic is what we actually own.
 */

const userCount = vi.fn();
const usageAggregate = vi.fn();

vi.mock('../../src/db/models/index.js', () => ({
  User: {
    countDocuments: (...args: unknown[]) => userCount(...args),
  },
  AiUsageLog: {
    aggregate: (...args: unknown[]) => usageAggregate(...args),
  },
}));

beforeEach(() => {
  userCount.mockReset();
  usageAggregate.mockReset();
});

describe('computeBillingMetrics', () => {
  test('rolls token totals into per-tier dollar cost', async () => {
    // First two calls hit User.countDocuments — totalUsers, proUsers
    userCount.mockResolvedValueOnce(120); // totalUsers
    userCount.mockResolvedValueOnce(8); // proUsers

    // Then four AiUsageLog.aggregate calls in order:
    //   1. active free users
    //   2. cost rows (per-tier × per-model token sums)
    //   3. message cap-hits
    //   4. url_note cap-hits
    usageAggregate.mockResolvedValueOnce([{ _id: 'free-1' }, { _id: 'free-2' }, { _id: 'free-3' }]);
    usageAggregate.mockResolvedValueOnce([
      // free user spend on the cheap model
      {
        _id: { tier: 'free', model: 'gemini-2.0-flash' },
        promptTokens: 500_000,
        outputTokens: 50_000,
      },
      // pro user spend on the strong model
      {
        _id: { tier: 'pro', model: 'gemini-2.5-flash' },
        promptTokens: 1_000_000,
        outputTokens: 200_000,
      },
    ]);
    usageAggregate.mockResolvedValueOnce([]); // no message cap hits
    usageAggregate.mockResolvedValueOnce([{ _id: { userId: 'u1', date: '2026-05-18' }, count: 3 }]);

    const m = await computeBillingMetrics();

    expect(m.totalUsers).toBe(120);
    expect(m.proUsers).toBe(8);
    expect(m.activeFreeUsers).toBe(3);
    // 8 pro / (8 pro + 3 active free) = 0.7272…
    expect(m.conversionRate).toBeCloseTo(8 / 11, 4);
    expect(m.estimatedMrrUsd).toBe(72); // 8 × $9

    // Free: 500k × 0.10/M + 50k × 0.40/M = $0.05 + $0.02 = $0.07
    expect(m.cost30dUsd.byTier.free).toBeCloseTo(0.07, 4);
    // Pro: 1M × 0.30/M + 200k × 2.50/M = $0.30 + $0.50 = $0.80
    expect(m.cost30dUsd.byTier.pro).toBeCloseTo(0.8, 4);
    expect(m.cost30dUsd.total).toBeCloseTo(0.87, 4);

    expect(m.capHits7d).toEqual({ message: 0, url_note: 1 });
  });

  test('conversion rate is zero when no users have used the product', async () => {
    userCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    usageAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const m = await computeBillingMetrics();
    expect(m.conversionRate).toBe(0);
    expect(m.estimatedMrrUsd).toBe(0);
    expect(m.cost30dUsd.total).toBe(0);
  });

  test('unknown model falls back to strong-model rates (no under-reporting)', async () => {
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    usageAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          _id: { tier: 'pro', model: 'gemini-3-future-flash' },
          promptTokens: 1_000_000,
          outputTokens: 100_000,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const m = await computeBillingMetrics();
    // Fell back to 2.5-flash rates: 1M × 0.30/M + 100k × 2.50/M = $0.55
    expect(m.cost30dUsd.byTier.pro).toBeCloseTo(0.55, 4);
  });
});
