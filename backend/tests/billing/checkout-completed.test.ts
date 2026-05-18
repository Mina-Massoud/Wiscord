import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type Stripe from 'stripe';

/**
 * H1 — `onCheckoutCompleted` now reconciles the subscription state
 * by fetching the subscription from Stripe and applying it via
 * `onSubscriptionChanged`. Closes the silent race where
 * `customer.subscription.created` arrives BEFORE
 * `checkout.session.completed`, can't find the user (customerId
 * not yet written), warns, and exits — leaving the user's tier
 * permanently stuck on Free until the next subscription lifecycle
 * event.
 *
 * H4 — split logger.warn / logger.error for missing customer vs
 * missing userId. Missing userId is a code-level misconfiguration
 * that must page; missing customerId is a known Stripe ordering
 * quirk and stays warn.
 */

const subsRetrieve = vi.fn();
const userFindByIdAndUpdate = vi.fn();
const userFindOneAndUpdate = vi.fn();
const loggerWarn = vi.fn();
const loggerError = vi.fn();

vi.mock('../../src/modules/billing/stripe-client.js', () => ({
  getStripe: () => ({
    subscriptions: { retrieve: (...args: unknown[]) => subsRetrieve(...args) },
  }),
}));

vi.mock('../../src/db/models/User.js', () => ({
  User: {
    findByIdAndUpdate: (...args: unknown[]) => userFindByIdAndUpdate(...args),
    findOneAndUpdate: (...args: unknown[]) => userFindOneAndUpdate(...args),
  },
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: (...args: unknown[]) => loggerError(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

beforeEach(() => {
  subsRetrieve.mockReset();
  userFindByIdAndUpdate.mockReset();
  userFindOneAndUpdate.mockReset();
  loggerWarn.mockReset();
  loggerError.mockReset();
  userFindByIdAndUpdate.mockResolvedValue({});
  userFindOneAndUpdate.mockReturnValue({
    lean: vi.fn().mockResolvedValue({ _id: 'u1' }),
  });
});

afterEach(() => {
  vi.resetModules();
});

function fakeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_1',
    customer: 'cus_test_1',
    metadata: { userId: 'user_alice' },
    subscription: 'sub_test_1',
    ...overrides,
  } as Stripe.Checkout.Session;
}

function fakeSubscription(): Stripe.Subscription {
  return {
    id: 'sub_test_1',
    customer: 'cus_test_1',
    status: 'active',
    items: {
      data: [{ current_period_end: Math.floor(Date.now() / 1000) + 28 * 86400 }],
    },
  } as unknown as Stripe.Subscription;
}

describe('onCheckoutCompleted — H1 + H4', () => {
  test('happy path: writes customerId AND reconciles subscription', async () => {
    subsRetrieve.mockResolvedValue(fakeSubscription());
    const { onCheckoutCompleted } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onCheckoutCompleted(fakeSession());

    // customerId write
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith('user_alice', {
      $set: { 'billing.stripeCustomerId': 'cus_test_1' },
    });
    // subscription back-fill — this is the H1 fix
    expect(subsRetrieve).toHaveBeenCalledWith('sub_test_1');
    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      { 'billing.stripeCustomerId': 'cus_test_1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          'billing.subscriptionStatus': 'active',
          'billing.subscriptionTier': 'pro',
        }),
      }),
      expect.anything(),
    );
  });

  test('H4: missing userId → logger.error (not warn) — paging alert', async () => {
    const { onCheckoutCompleted } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onCheckoutCompleted(fakeSession({ metadata: {} }));
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerWarn).not.toHaveBeenCalled();
    // No writes attempted without userId.
    expect(userFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('H4: missing customerId → logger.warn (known race, no page)', async () => {
    const { onCheckoutCompleted } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onCheckoutCompleted(
      fakeSession({ customer: null as unknown as Stripe.Checkout.Session['customer'] }),
    );
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerError).not.toHaveBeenCalled();
    expect(userFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('H1: subscription.retrieve failure still writes customerId + logs error', async () => {
    subsRetrieve.mockRejectedValue(new Error('stripe down'));
    const { onCheckoutCompleted } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    // Critical: the customerId write must happen BEFORE the
    // retrieve attempt — so a follow-up subscription event can
    // still find the user even if back-fill fails.
    await onCheckoutCompleted(fakeSession());
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith('user_alice', {
      $set: { 'billing.stripeCustomerId': 'cus_test_1' },
    });
    expect(loggerError).toHaveBeenCalled();
  });

  test('session without subscription field → skip back-fill silently', async () => {
    const { onCheckoutCompleted } = await import(
      '../../src/modules/billing/webhook-handlers.js'
    );
    await onCheckoutCompleted(
      fakeSession({ subscription: null as unknown as Stripe.Checkout.Session['subscription'] }),
    );
    expect(userFindByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(subsRetrieve).not.toHaveBeenCalled();
  });
});
