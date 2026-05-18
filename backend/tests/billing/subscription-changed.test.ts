import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type Stripe from 'stripe';

/**
 * M4 — `incomplete` / `incomplete_expired` subs collapse to
 * `canceled` in our enum but Stripe can stamp a future
 * `current_period_end` on them (trial setups, in-flight 3DS).
 * Honoring that value would mean `resolveEffectiveTier` grants Pro
 * to a never-paid customer (status: canceled + periodEnd in future
 * → pro grace). Tests pin: incomplete writes null periodEnd.
 *
 * M5 — dispute.created with `dispute.charge` as a string id must
 * resolve the charge via Stripe.charges.retrieve so the customer
 * id is always discoverable. Old code returned silently in this
 * case.
 */

const userFindOneAndUpdate = vi.fn();
const chargesRetrieve = vi.fn();

vi.mock('../../src/db/models/User.js', () => ({
  User: {
    findOneAndUpdate: (...args: unknown[]) => userFindOneAndUpdate(...args),
  },
}));

vi.mock('../../src/modules/billing/stripe-client.js', () => ({
  getStripe: () => ({
    charges: { retrieve: (...args: unknown[]) => chargesRetrieve(...args) },
    subscriptions: { retrieve: vi.fn() },
  }),
}));

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

beforeEach(() => {
  userFindOneAndUpdate.mockReset();
  chargesRetrieve.mockReset();
  userFindOneAndUpdate.mockReturnValue({
    lean: vi.fn().mockResolvedValue({ _id: 'u1' }),
  });
});

afterEach(() => {
  vi.resetModules();
});

function fakeSub(
  status: Stripe.Subscription.Status,
  periodEndUnix: number,
): Stripe.Subscription {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status,
    items: { data: [{ current_period_end: periodEndUnix }] },
  } as unknown as Stripe.Subscription;
}

describe('onSubscriptionChanged — M4 incomplete periodEnd nullification', () => {
  const future = Math.floor(Date.now() / 1000) + 7 * 86400;

  test('incomplete + future periodEnd → currentPeriodEnd written as null', async () => {
    const { onSubscriptionChanged } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onSubscriptionChanged(fakeSub('incomplete', future));
    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      { 'billing.stripeCustomerId': 'cus_1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          'billing.subscriptionStatus': 'canceled',
          'billing.subscriptionTier': 'free',
          'billing.currentPeriodEnd': null,
        }),
      }),
      expect.anything(),
    );
  });

  test('incomplete_expired + future periodEnd → currentPeriodEnd null', async () => {
    const { onSubscriptionChanged } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onSubscriptionChanged(fakeSub('incomplete_expired', future));
    const call = userFindOneAndUpdate.mock.calls[0]?.[1];
    expect(call?.$set?.['billing.currentPeriodEnd']).toBeNull();
  });

  test('canceled + future periodEnd → currentPeriodEnd preserved (grace path)', async () => {
    // The legitimate cancel-grace flow: a real paid sub the user
    // cancelled. periodEnd must survive so resolveEffectiveTier
    // can grant Pro until it lapses.
    const { onSubscriptionChanged } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onSubscriptionChanged(fakeSub('canceled', future));
    const call = userFindOneAndUpdate.mock.calls[0]?.[1];
    expect(call?.$set?.['billing.currentPeriodEnd']).toBeInstanceOf(Date);
  });

  test('active + periodEnd → preserved (renewal date)', async () => {
    const { onSubscriptionChanged } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onSubscriptionChanged(fakeSub('active', future));
    const call = userFindOneAndUpdate.mock.calls[0]?.[1];
    expect(call?.$set?.['billing.subscriptionTier']).toBe('pro');
    expect(call?.$set?.['billing.currentPeriodEnd']).toBeInstanceOf(Date);
  });
});

describe('onChargeDisputeCreated — M5 charge resolution', () => {
  test('expanded charge object → uses customer directly, no fetch', async () => {
    const { onChargeDisputeCreated } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    const dispute = {
      id: 'dp_1',
      reason: 'fraudulent',
      charge: { id: 'ch_1', customer: 'cus_dispute' },
    } as unknown as Stripe.Dispute;
    await onChargeDisputeCreated(dispute);
    expect(chargesRetrieve).not.toHaveBeenCalled();
    // Downgrade hits the User model with the right customer id.
    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      { 'billing.stripeCustomerId': 'cus_dispute' },
      expect.objectContaining({
        $set: expect.objectContaining({ 'billing.subscriptionTier': 'free' }),
      }),
      expect.anything(),
    );
  });

  test('string charge id → fetches charge then downgrades', async () => {
    // The pre-M5 bug: Stripe webhook config without object expansion
    // delivers `dispute.charge` as a string id. Old code returned
    // silently. New code fetches the charge so revocation always
    // runs.
    chargesRetrieve.mockResolvedValue({ id: 'ch_string_1', customer: 'cus_string_dispute' });
    const { onChargeDisputeCreated } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    const dispute = {
      id: 'dp_2',
      reason: 'fraudulent',
      charge: 'ch_string_1',
    } as unknown as Stripe.Dispute;
    await onChargeDisputeCreated(dispute);
    expect(chargesRetrieve).toHaveBeenCalledWith('ch_string_1');
    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      { 'billing.stripeCustomerId': 'cus_string_dispute' },
      expect.objectContaining({
        $set: expect.objectContaining({ 'billing.subscriptionTier': 'free' }),
      }),
      expect.anything(),
    );
  });

  test('charge fetch fails → no downgrade, no throw (logged at error)', async () => {
    chargesRetrieve.mockRejectedValue(new Error('stripe down'));
    const { onChargeDisputeCreated } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    const dispute = {
      id: 'dp_3',
      charge: 'ch_unfetchable',
    } as unknown as Stripe.Dispute;
    await expect(onChargeDisputeCreated(dispute)).resolves.toBeUndefined();
    // Downgrade did NOT run — we couldn't find the customer.
    // The audit accepts this as "manual intervention needed" path,
    // logged at error level for on-call visibility.
    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
