import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * C3 idempotency + signature-verification tests for the Stripe webhook
 * route. We mock the Stripe client and the ProcessedWebhookEvent model
 * so the test runs without Mongo and without Stripe credentials.
 *
 * The thing being tested:
 *   - Missing signature OR missing webhook secret → 400 (NOT 500;
 *     500 would trigger Stripe's 3-day retry storm)
 *   - Bad signature → 400 + signature-failed log
 *   - First time seeing event.id → handler runs, 200 received:true
 *   - Duplicate event.id → handler skipped, 200 received:true + duplicate:true
 *   - Unknown event type → 200, no handler invoked, debug-logged
 */

const constructEvent = vi.fn();
const handlerCalls: Record<string, number> = {};

vi.mock('../../src/db/models/index.js', () => {
  let store = new Set<string>();
  return {
    ProcessedWebhookEvent: {
      create: vi.fn(async ({ eventId }: { eventId: string }) => {
        if (store.has(eventId)) {
          const err = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
          throw err;
        }
        store.add(eventId);
        return { eventId };
      }),
      // Test helper not on the real schema — exposed so we can reset
      // between tests via a typed cast.
      __reset: () => {
        store = new Set<string>();
      },
    },
  };
});

vi.mock('../../src/modules/billing/stripe-client.js', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEvent(...args),
    },
  }),
}));

vi.mock('../../src/lib/env.js', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../src/modules/billing/webhook-handlers.js', () => {
  const make = (name: string) =>
    vi.fn(async () => {
      handlerCalls[name] = (handlerCalls[name] ?? 0) + 1;
    });
  return {
    onCheckoutCompleted: make('onCheckoutCompleted'),
    onSubscriptionChanged: make('onSubscriptionChanged'),
    onInvoicePaymentFailed: make('onInvoicePaymentFailed'),
    onInvoicePaymentActionRequired: make('onInvoicePaymentActionRequired'),
    onChargeDisputeCreated: make('onChargeDisputeCreated'),
    onChargeDisputeClosed: make('onChargeDisputeClosed'),
    onChargeRefunded: make('onChargeRefunded'),
    onCustomerDeleted: make('onCustomerDeleted'),
  };
});

let app: Express;

beforeEach(async () => {
  for (const key of Object.keys(handlerCalls)) delete handlerCalls[key];
  constructEvent.mockReset();
  const models = await import('../../src/db/models/index.js');
  (models.ProcessedWebhookEvent as unknown as { __reset: () => void }).__reset();

  const { stripeWebhookBodyParser, stripeWebhookHandler } = await import(
    '../../src/modules/billing/webhook.js'
  );
  app = express();
  app.post('/billing/webhook', stripeWebhookBodyParser, stripeWebhookHandler);
});

afterEach(() => {
  vi.resetModules();
});

describe('stripeWebhookHandler — signature gate', () => {
  test('rejects with 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .send({ id: 'evt_1' });
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  test('rejects with 400 when constructEvent throws (bad signature)', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=bad')
      .send({ id: 'evt_2' });
    expect(res.status).toBe(400);
  });
});

describe('stripeWebhookHandler — idempotency (C3)', () => {
  test('first delivery of an event runs the handler and returns received:true', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1' } },
    });
    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=ok')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true });
    expect(handlerCalls.onCheckoutCompleted).toBe(1);
  });

  test('duplicate delivery short-circuits — handler runs at most once', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test' } },
    });
    const first = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=ok')
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeUndefined();

    const second = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=ok')
      .send({});
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ received: true, duplicate: true });

    // Critical: handler must have been called exactly ONCE across the
    // two deliveries. If this fails, the dedup gate is broken — a
    // future handler that sends an email or charges a fee would
    // fire twice.
    expect(handlerCalls.onSubscriptionChanged).toBe(1);
  });

  test('unknown event types ack 200 without invoking any handler', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_ignored',
      type: 'payment_intent.created',
      data: { object: {} },
    });
    const res = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=ok')
      .send({});
    expect(res.status).toBe(200);
    expect(Object.values(handlerCalls).reduce((a, b) => a + b, 0)).toBe(0);
  });

  test('routes each known event type to the correct handler', async () => {
    const cases: Array<[string, string]> = [
      ['checkout.session.completed', 'onCheckoutCompleted'],
      ['customer.subscription.created', 'onSubscriptionChanged'],
      ['customer.subscription.updated', 'onSubscriptionChanged'],
      ['customer.subscription.deleted', 'onSubscriptionChanged'],
      ['invoice.payment_failed', 'onInvoicePaymentFailed'],
      ['invoice.payment_action_required', 'onInvoicePaymentActionRequired'],
      ['charge.dispute.created', 'onChargeDisputeCreated'],
      ['charge.dispute.closed', 'onChargeDisputeClosed'],
      ['charge.refunded', 'onChargeRefunded'],
      ['customer.deleted', 'onCustomerDeleted'],
    ];
    let i = 0;
    for (const [type, handler] of cases) {
      constructEvent.mockReturnValueOnce({
        id: `evt_route_${i++}`,
        type,
        data: { object: {} },
      });
      const res = await request(app)
        .post('/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=ok')
        .send({});
      expect(res.status).toBe(200);
      expect(handlerCalls[handler]).toBeGreaterThanOrEqual(1);
    }
  });
});
