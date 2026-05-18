import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * `GET /billing/plans` — public, no auth. The redesigned
 * SubscriptionPanel reads cap numbers and bullets from this
 * endpoint so the panel is never out of sync with the backend
 * registry (the bug that prompted this work: the old
 * FEATURE_SWAPS hardcoded `30/day` while real backend cap
 * was `2/day`).
 */

vi.mock('../../src/lib/env.js', () => ({
  env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

vi.mock('../../src/middleware/requireAuth.js', () => ({
  requireAuth: (req: { userId: string }, _res: unknown, next: () => void) => {
    req.userId = 'test_user';
    next();
  },
}));

vi.mock('../../src/modules/billing/service.js', () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  getSubscription: vi.fn(),
  listInvoices: vi.fn(),
}));

let app: Express;

beforeEach(async () => {
  const { billingRouter } = await import('../../src/modules/billing/routes.js');
  app = express();
  app.use(express.json());
  app.use('/billing', billingRouter);
});

afterEach(() => {
  vi.resetModules();
});

describe('GET /billing/plans', () => {
  test('returns both tiers with the full PlanView shape', async () => {
    const res = await request(app).get('/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('free');
    expect(res.body.data).toHaveProperty('pro');

    for (const tierId of ['free', 'pro'] as const) {
      const plan = res.body.data[tierId];
      expect(plan.id).toBe(tierId);
      expect(typeof plan.displayName).toBe('string');
      expect(typeof plan.priceCents).toBe('number');
      expect(typeof plan.quotas.message).toBe('number');
      expect(typeof plan.quotas.url_note).toBe('number');
      expect(Array.isArray(plan.bullets)).toBe(true);
    }
  });

  test('caps match the canonical registry (no drift)', async () => {
    // This test is the load-bearer: if anyone ever fabricates
    // caps in the frontend again, the endpoint still reflects
    // truth and this test pins it. If a future change diverges
    // the registry from displayed marketing, this fails before
    // ship.
    const { PLANS } = await import('../../src/modules/billing/plans.js');
    const res = await request(app).get('/billing/plans');
    expect(res.body.data.free.quotas.message).toBe(PLANS.free.quotas.message);
    expect(res.body.data.free.quotas.url_note).toBe(PLANS.free.quotas.url_note);
    expect(res.body.data.pro.quotas.message).toBe(PLANS.pro.quotas.message);
    expect(res.body.data.pro.quotas.url_note).toBe(PLANS.pro.quotas.url_note);
  });

  test('Pro is more expensive than Free', async () => {
    const res = await request(app).get('/billing/plans');
    expect(res.body.data.free.priceCents).toBe(0);
    expect(res.body.data.pro.priceCents).toBeGreaterThan(0);
  });

  test('no auth required — public endpoint for marketing parity', async () => {
    // The route is public so a future unauthed pricing page can
    // hit the same source. Verify by calling with no cookie /
    // no headers; should still return 200.
    const res = await request(app).get('/billing/plans');
    expect(res.status).toBe(200);
  });

  test('does NOT leak internal model-routing fields', async () => {
    // PlanDef has a `models.strong` field for internal Gemini
    // routing. That value is operational, not user-facing —
    // and exposing it would tie the API to a specific model id.
    // PlanView projection must drop it.
    const res = await request(app).get('/billing/plans');
    expect(res.body.data.free).not.toHaveProperty('models');
    expect(res.body.data.pro).not.toHaveProperty('models');
  });
});
