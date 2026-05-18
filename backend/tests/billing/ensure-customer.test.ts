import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * H1 — atomic Stripe customer creation under concurrent checkout.
 * M2 — refuse non-ObjectId userIds before Stripe search interpolation.
 * M3 — multi-match in metadata recovery → warn and return null.
 *
 * `ensureStripeCustomer` is internal; we drive it through the public
 * `createCheckoutSession` entry point and assert on the Stripe + Mongo
 * calls. The Stripe SDK and the User model are both mocked so the
 * tests run without network or DB.
 */

const VALID_USER_ID = '5f9a4b2c8e1d3f7a6b9c0e12'; // 24 hex chars
const VALID_USER_ID_2 = '5f9a4b2c8e1d3f7a6b9c0e34';

const customersCreate = vi.fn();
const customersDelete = vi.fn();
const customersRetrieve = vi.fn();
const customersSearch = vi.fn();
const checkoutSessionsCreate = vi.fn();

const userFindById = vi.fn();
const userFindOneAndUpdate = vi.fn();
const userFindByIdAndUpdate = vi.fn();

vi.mock('../../src/modules/billing/stripe-client.js', () => ({
  getStripe: () => ({
    customers: {
      create: (...args: unknown[]) => customersCreate(...args),
      del: (...args: unknown[]) => customersDelete(...args),
      retrieve: (...args: unknown[]) => customersRetrieve(...args),
      search: (...args: unknown[]) => customersSearch(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => checkoutSessionsCreate(...args),
      },
    },
  }),
}));

vi.mock('../../src/lib/env.js', () => ({
  env: {
    STRIPE_PRICE_PRO_MONTHLY: 'price_test_123',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../src/db/models/User.js', () => ({
  User: {
    findById: (...args: unknown[]) => userFindById(...args),
    findOneAndUpdate: (...args: unknown[]) => userFindOneAndUpdate(...args),
    findByIdAndUpdate: (...args: unknown[]) => userFindByIdAndUpdate(...args),
  },
}));

/**
 * Build the `.select(...).lean()` chain that `loadUser` uses on
 * the read side. We return whatever billing shape the caller wants.
 */
function mockFindByIdReturning(user: {
  email: string;
  username: string;
  billing?: Record<string, unknown>;
}): void {
  userFindById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(user),
    }),
  });
}

function mockClaimReturning(
  claim: { billing?: { stripeCustomerId?: string | null } } | null,
): void {
  userFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(claim) });
}

beforeEach(() => {
  customersCreate.mockReset();
  customersDelete.mockReset();
  customersRetrieve.mockReset();
  customersSearch.mockReset();
  checkoutSessionsCreate.mockReset();
  userFindById.mockReset();
  userFindOneAndUpdate.mockReset();
  userFindByIdAndUpdate.mockReset();
  checkoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/success' });
});

afterEach(() => {
  vi.resetModules();
});

describe('createCheckoutSession — H1 atomic customer creation', () => {
  test('happy path: no cached customer, no race, creates + claims', async () => {
    // First loadUser (inside resolveLiveCustomerId): no cached id, no recovery match
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockResolvedValue({ data: [] });
    // Second loadUser (inside ensureStripeCustomer): same row
    customersCreate.mockResolvedValue({ id: 'cus_new_1' });
    mockClaimReturning({ billing: { stripeCustomerId: 'cus_new_1' } });

    const { createCheckoutSession } = await import('../../src/modules/billing/service.js');
    const res = await createCheckoutSession({
      userId: VALID_USER_ID,
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/cancel',
    });
    expect(res.url).toMatch(/^https:\/\/checkout.stripe.test/);
    expect(customersCreate).toHaveBeenCalledTimes(1);
    expect(customersDelete).not.toHaveBeenCalled();
  });

  test('race-LOSER path: claim returns winner id, our customer gets deleted', async () => {
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: 'cus_orphan' });
    // Claim returns a DIFFERENT id — another concurrent request won.
    mockClaimReturning({ billing: { stripeCustomerId: 'cus_winner' } });
    customersDelete.mockResolvedValue({ id: 'cus_orphan', deleted: true });

    const { createCheckoutSession } = await import('../../src/modules/billing/service.js');
    const res = await createCheckoutSession({
      userId: VALID_USER_ID,
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/cancel',
    });
    expect(res.url).toBeTruthy();
    // Orphan must be cleaned up so it can't accidentally accept a
    // subscription we'd never see — that's the audit's worst case.
    expect(customersDelete).toHaveBeenCalledWith('cus_orphan');
    // Checkout session was opened against the WINNER, not the orphan.
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_winner' }),
    );
  });

  test('race-loser orphan delete failure logs warn but does NOT throw', async () => {
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: 'cus_orphan_2' });
    mockClaimReturning({ billing: { stripeCustomerId: 'cus_winner_2' } });
    customersDelete.mockRejectedValue(new Error('stripe down'));

    const { createCheckoutSession } = await import('../../src/modules/billing/service.js');
    // Critical: the delete is best-effort. The session must still open
    // for the winning customer even if the orphan can't be reaped now.
    const res = await createCheckoutSession({
      userId: VALID_USER_ID,
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/cancel',
    });
    expect(res.url).toBeTruthy();
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_winner_2' }),
    );
  });

  test('null claim with no winner id → 500 (defensive guard)', async () => {
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: 'cus_x' });
    // Claim returned null — user doc was deleted between create and claim.
    mockClaimReturning(null);
    customersDelete.mockResolvedValue({ id: 'cus_x', deleted: true });

    const { createCheckoutSession } = await import('../../src/modules/billing/service.js');
    await expect(
      createCheckoutSession({
        userId: VALID_USER_ID,
        successUrl: 'https://app/ok',
        cancelUrl: 'https://app/cancel',
      }),
    ).rejects.toMatchObject({
      status: 500,
      code: 'billing_customer_race_lost_no_winner',
    });
  });

  test('uses cached id when resolveLiveCustomerId succeeds — no race needed', async () => {
    mockFindByIdReturning({
      email: 'a@b.com',
      username: 'alice',
      billing: { stripeCustomerId: 'cus_cached' },
    });
    customersRetrieve.mockResolvedValue({ id: 'cus_cached' });

    const { createCheckoutSession } = await import('../../src/modules/billing/service.js');
    const res = await createCheckoutSession({
      userId: VALID_USER_ID,
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/cancel',
    });
    expect(res.url).toBeTruthy();
    expect(customersCreate).not.toHaveBeenCalled();
    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_cached' }),
    );
  });
});

describe('recoverCustomerByMetadata — M2 + M3 hardening (via createPortalSession)', () => {
  test('M2: refuses non-ObjectId userId before touching Stripe.search', async () => {
    // No cached id, no live customer; portal will throw billing_no_customer
    // because the recovery search must NEVER run for a malformed userId.
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });

    const { createPortalSession } = await import('../../src/modules/billing/service.js');
    await expect(
      createPortalSession({ userId: 'not-an-objectid', returnUrl: 'https://app/back' }),
    ).rejects.toMatchObject({ code: 'billing_no_customer' });
    expect(customersSearch).not.toHaveBeenCalled();
  });

  test('M3: multi-customer search → warn + null (treated as billing_no_customer)', async () => {
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockResolvedValue({
      data: [{ id: 'cus_dup_1' }, { id: 'cus_dup_2' }],
    });

    const { createPortalSession } = await import('../../src/modules/billing/service.js');
    // Multi-match is ambiguous — we refuse to guess. Surface as the
    // standard no-customer error so the user gets a clear "no portal
    // available" path instead of getting routed to the wrong customer.
    await expect(
      createPortalSession({ userId: VALID_USER_ID, returnUrl: 'https://app/back' }),
    ).rejects.toMatchObject({ code: 'billing_no_customer' });
    expect(customersSearch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 2 }),
    );
  });

  test('H6: Stripe auth error → 502 billing_stripe_unavailable (not no_customer)', async () => {
    // The audit's H6 case: rotated API key or rate limit returns a
    // Stripe error from search → must propagate as 502, NOT collapse
    // into billing_no_customer (which would look like "you have no
    // account" to a user with an active subscription).
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    const authErr = Object.assign(new Error('Invalid API Key'), {
      type: 'StripeAuthenticationError',
    });
    customersSearch.mockRejectedValue(authErr);

    const { createPortalSession } = await import('../../src/modules/billing/service.js');
    await expect(
      createPortalSession({ userId: VALID_USER_ID, returnUrl: 'https://app/back' }),
    ).rejects.toMatchObject({
      status: 502,
      code: 'billing_stripe_unavailable',
    });
  });

  test('H6: Stripe rate-limit error → 502 (not silently null)', async () => {
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    const rateErr = Object.assign(new Error('Too many requests'), {
      type: 'StripeRateLimitError',
    });
    customersSearch.mockRejectedValue(rateErr);

    const { createPortalSession } = await import('../../src/modules/billing/service.js');
    await expect(
      createPortalSession({ userId: VALID_USER_ID, returnUrl: 'https://app/back' }),
    ).rejects.toMatchObject({
      status: 502,
      code: 'billing_stripe_unavailable',
    });
  });

  test('non-Stripe-typed search error → null fallback (no 502)', async () => {
    // A generic JS error (e.g. our own helper throwing) should NOT
    // trigger the 502 path. Only Stripe SDK errors with `type` in
    // the unavailable set escalate.
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockRejectedValue(new Error('some generic error'));

    const { createPortalSession } = await import('../../src/modules/billing/service.js');
    await expect(
      createPortalSession({ userId: VALID_USER_ID, returnUrl: 'https://app/back' }),
    ).rejects.toMatchObject({ code: 'billing_no_customer' });
  });

  test('single-match search → adopts the customer + opens portal', async () => {
    // First call: loadUser inside resolveLiveCustomerId.
    // Second call: same. Returning the same shape both times is fine.
    mockFindByIdReturning({ email: 'a@b.com', username: 'alice' });
    customersSearch.mockResolvedValue({ data: [{ id: 'cus_recovered' }] });
    userFindByIdAndUpdate.mockResolvedValue({});
    // Add a mock for the portal sessions create that mirrors checkout.
    const billingPortalCreate = vi.fn().mockResolvedValue({ url: 'https://portal.test' });
    // Re-mock stripe-client for this case to include billingPortal.
    vi.doMock('../../src/modules/billing/stripe-client.js', () => ({
      getStripe: () => ({
        customers: {
          create: customersCreate,
          del: customersDelete,
          retrieve: customersRetrieve,
          search: customersSearch,
        },
        billingPortal: {
          sessions: { create: billingPortalCreate },
        },
      }),
    }));
    const { createPortalSession } = await import('../../src/modules/billing/service.js');
    const res = await createPortalSession({
      userId: VALID_USER_ID_2,
      returnUrl: 'https://app/back',
    });
    expect(res.url).toBe('https://portal.test');
    expect(billingPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_recovered' }),
    );
  });
});
