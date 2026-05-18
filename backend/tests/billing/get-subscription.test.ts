import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * C2 audit fix — `getSubscription` must route the `tier` field
 * through `resolveEffectiveTier` so the cancel-grace user gets
 * `tier: 'pro'` from the API even though the denormalized field
 * was written as `'free'` by the webhook. The status field still
 * passes through raw so the StatusBanner can render
 * "Pro access ends on …" copy off the cancel state.
 */

const userFindById = vi.fn();

vi.mock('../../src/db/models/User.js', () => ({
  User: {
    findById: (...args: unknown[]) => userFindById(...args),
  },
}));

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

vi.mock('../../src/modules/billing/stripe-client.js', () => ({
  getStripe: () => ({}),
}));

function mockUser(billing: Record<string, unknown> | null | undefined): void {
  userFindById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ email: 'a@b.com', username: 'alice', billing }),
    }),
  });
}

beforeEach(() => {
  userFindById.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe('getSubscription — C2 effective tier through resolver', () => {
  test('canceled + currentPeriodEnd in future → tier resolves to pro', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockUser({
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free', // webhook wrote this on cancel
      currentPeriodEnd: future,
      stripeCustomerId: 'cus_x',
    });
    const { getSubscription } = await import('../../src/modules/billing/service.js');
    const result = await getSubscription('507f1f77bcf86cd799439011');
    // The denormalized `subscriptionTier` field reads `'free'` — but
    // the effective tier honors the paid grace window and returns Pro.
    // Without this fix, Settings would show "upgrade · $9/mo" while
    // `/ai/quota` still served Pro caps.
    expect(result.tier).toBe('pro');
    expect(result.status).toBe('canceled');
    expect(result.currentPeriodEnd).toBe(future.toISOString());
  });

  test('canceled + currentPeriodEnd in past → tier resolves to free', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockUser({
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free',
      currentPeriodEnd: past,
    });
    const { getSubscription } = await import('../../src/modules/billing/service.js');
    const result = await getSubscription('507f1f77bcf86cd799439011');
    expect(result.tier).toBe('free');
    expect(result.status).toBe('canceled');
  });

  test('past_due → tier resolves to pro (Smart Retries grace)', async () => {
    mockUser({
      subscriptionStatus: 'past_due',
      subscriptionTier: 'pro',
      currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    const { getSubscription } = await import('../../src/modules/billing/service.js');
    const result = await getSubscription('507f1f77bcf86cd799439011');
    expect(result.tier).toBe('pro');
    expect(result.status).toBe('past_due');
  });

  test('active → tier resolves to pro', async () => {
    mockUser({
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
      currentPeriodEnd: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    });
    const { getSubscription } = await import('../../src/modules/billing/service.js');
    const result = await getSubscription('507f1f77bcf86cd799439011');
    expect(result.tier).toBe('pro');
  });

  test('paused → tier resolves to free (M3 status escape covered)', async () => {
    // M3 — paused / unpaid are valid model values that the response
    // type now exposes. The resolver maps them to Free (no grace).
    mockUser({
      subscriptionStatus: 'paused',
      subscriptionTier: 'pro', // stale denormalized value
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const { getSubscription } = await import('../../src/modules/billing/service.js');
    const result = await getSubscription('507f1f77bcf86cd799439011');
    expect(result.tier).toBe('free');
    expect(result.status).toBe('paused');
  });

  test('no billing subdoc → tier free, hasCustomer false', async () => {
    mockUser(undefined);
    const { getSubscription } = await import('../../src/modules/billing/service.js');
    const result = await getSubscription('507f1f77bcf86cd799439011');
    expect(result).toEqual({
      status: 'none',
      tier: 'free',
      currentPeriodEnd: null,
      hasCustomer: false,
      cancelAtPeriodEnd: false,
    });
  });
});
