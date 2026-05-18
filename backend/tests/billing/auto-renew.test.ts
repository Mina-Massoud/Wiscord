import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * `setAutoRenew` — flips Stripe's `cancel_at_period_end` flag and
 * writes the result locally so the UI doesn't have to wait for
 * the webhook to settle.
 *
 * Tests pin:
 *   - The Stripe SDK is called with the correctly-inverted flag
 *     (auto-renew enabled === cancel_at_period_end false)
 *   - The local write happens after a successful Stripe call so
 *     the next useSubscription read sees the new state
 *   - billing_no_subscription is thrown when the user has no
 *     active sub (avoids a confusing 4xx from Stripe directly)
 *   - Stripe API unavailability surfaces as 502, not 500
 */

const VALID_USER_ID = '5f9a4b2c8e1d3f7a6b9c0e12';

const subsUpdate = vi.fn();
const userFindById = vi.fn();
const userFindByIdAndUpdate = vi.fn();

vi.mock('../../src/modules/billing/stripe-client.js', () => ({
  getStripe: () => ({
    subscriptions: { update: (...args: unknown[]) => subsUpdate(...args) },
  }),
}));

vi.mock('../../src/db/models/User.js', () => ({
  User: {
    findById: (...args: unknown[]) => userFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => userFindByIdAndUpdate(...args),
  },
}));

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

function mockLoadUserReturning(billing: Record<string, unknown> | undefined): void {
  userFindById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ email: 'a@b.com', username: 'alice', billing }),
    }),
  });
}

beforeEach(() => {
  subsUpdate.mockReset();
  userFindById.mockReset();
  userFindByIdAndUpdate.mockReset();
  userFindByIdAndUpdate.mockResolvedValue({});
});

afterEach(() => {
  vi.resetModules();
});

describe('setAutoRenew', () => {
  test('enabled=false → Stripe.subscriptions.update with cancel_at_period_end: true', async () => {
    mockLoadUserReturning({
      stripeCustomerId: 'cus_1',
      subscriptionId: 'sub_active',
    });
    subsUpdate.mockResolvedValue({
      id: 'sub_active',
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 7 * 86400 }] },
    });

    const { setAutoRenew } = await import('../../src/modules/billing/service.js');
    const result = await setAutoRenew({ userId: VALID_USER_ID, enabled: false });

    expect(subsUpdate).toHaveBeenCalledWith('sub_active', { cancel_at_period_end: true });
    expect(result.enabled).toBe(false);
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith(
      VALID_USER_ID,
      expect.objectContaining({
        $set: expect.objectContaining({
          'billing.cancelAtPeriodEnd': true,
        }),
      }),
    );
  });

  test('enabled=true → cancel_at_period_end: false (re-enable auto-renew)', async () => {
    mockLoadUserReturning({
      stripeCustomerId: 'cus_1',
      subscriptionId: 'sub_active',
    });
    subsUpdate.mockResolvedValue({
      id: 'sub_active',
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
    });

    const { setAutoRenew } = await import('../../src/modules/billing/service.js');
    const result = await setAutoRenew({ userId: VALID_USER_ID, enabled: true });

    expect(subsUpdate).toHaveBeenCalledWith('sub_active', { cancel_at_period_end: false });
    expect(result.enabled).toBe(true);
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith(
      VALID_USER_ID,
      expect.objectContaining({
        $set: expect.objectContaining({ 'billing.cancelAtPeriodEnd': false }),
      }),
    );
  });

  test('no subscription on user → 400 billing_no_subscription', async () => {
    mockLoadUserReturning({ stripeCustomerId: 'cus_1' /* no subscriptionId */ });
    const { setAutoRenew } = await import('../../src/modules/billing/service.js');
    await expect(setAutoRenew({ userId: VALID_USER_ID, enabled: false })).rejects.toMatchObject({
      status: 400,
      code: 'billing_no_subscription',
    });
    expect(subsUpdate).not.toHaveBeenCalled();
  });

  test('Stripe auth error → 502 billing_stripe_unavailable', async () => {
    mockLoadUserReturning({
      stripeCustomerId: 'cus_1',
      subscriptionId: 'sub_active',
    });
    const authErr = Object.assign(new Error('Invalid API Key'), {
      type: 'StripeAuthenticationError',
    });
    subsUpdate.mockRejectedValue(authErr);

    const { setAutoRenew } = await import('../../src/modules/billing/service.js');
    await expect(setAutoRenew({ userId: VALID_USER_ID, enabled: false })).rejects.toMatchObject({
      status: 502,
      code: 'billing_stripe_unavailable',
    });
    // Local write must NOT happen if Stripe rejected — we don't want
    // a local "auto-renew off" state that Stripe never enforced.
    expect(userFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('returns updated currentPeriodEnd from Stripe response', async () => {
    mockLoadUserReturning({
      stripeCustomerId: 'cus_1',
      subscriptionId: 'sub_active',
    });
    const periodEnd = Math.floor(Date.now() / 1000) + 14 * 86400;
    subsUpdate.mockResolvedValue({
      id: 'sub_active',
      items: { data: [{ current_period_end: periodEnd }] },
    });

    const { setAutoRenew } = await import('../../src/modules/billing/service.js');
    const result = await setAutoRenew({ userId: VALID_USER_ID, enabled: false });

    expect(result.currentPeriodEnd).toBe(new Date(periodEnd * 1000).toISOString());
  });
});
