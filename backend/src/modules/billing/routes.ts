import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../lib/env.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { PLANS, type PlanDef, type PlanId } from './plans.js';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  listInvoices,
  setAutoRenew,
} from './service.js';

export const billingRouter: Router = Router();

/**
 * Plan registry projection sent to the frontend. Drops the
 * model-routing field (internal-only, no UI value) and keeps
 * everything the SubscriptionPanel needs to render usage bars
 * and the "Pro also includes" feature line. Adding a new tier
 * flows through here automatically — the panel reads from
 * whatever this endpoint returns, no hardcoded marketing copy.
 */
interface PlanView {
  id: PlanId;
  displayName: string;
  priceCents: number;
  quotas: PlanDef['quotas'];
  bullets: string[];
}

function toPlanView(plan: PlanDef): PlanView {
  return {
    id: plan.id,
    displayName: plan.displayName,
    priceCents: plan.priceCents,
    quotas: plan.quotas,
    bullets: plan.bullets,
  };
}

/**
 * Public — no auth. The plan registry is the same shape we'd
 * publish on a marketing page; gating it behind login adds no
 * value and forces the unauthed pricing page (when we build it)
 * to keep a parallel copy.
 */
billingRouter.get('/plans', (_req, res) => {
  res.json(
    ok({
      free: toPlanView(PLANS.free),
      pro: toPlanView(PLANS.pro),
    }),
  );
});

billingRouter.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const data = await getSubscription(req.userId!);
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
});

const checkoutBody = z
  .object({
    /** Path under FRONTEND_ORIGIN to land on after Checkout. */
    returnPath: z.string().startsWith('/').max(2048).optional(),
  })
  .strict();

billingRouter.post('/checkout-session', requireAuth, async (req, res, next) => {
  try {
    const { returnPath } = checkoutBody.parse(req.body ?? {});
    const base = env.FRONTEND_ORIGIN;
    const landing = returnPath ?? '/app';
    const result = await createCheckoutSession({
      userId: req.userId!,
      successUrl: `${base}${landing}?checkout=success`,
      cancelUrl: `${base}${landing}?checkout=cancelled`,
    });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

const portalBody = z
  .object({
    returnPath: z.string().startsWith('/').max(2048).optional(),
  })
  .strict();

billingRouter.post('/portal-session', requireAuth, async (req, res, next) => {
  try {
    const { returnPath } = portalBody.parse(req.body ?? {});
    const result = await createPortalSession({
      userId: req.userId!,
      returnUrl: `${env.FRONTEND_ORIGIN}${returnPath ?? '/app'}`,
    });
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

billingRouter.get('/invoices', requireAuth, async (req, res, next) => {
  try {
    const data = await listInvoices(req.userId!);
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
});

const autoRenewBody = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

/**
 * In-app auto-renew toggle. Drives the Switch in
 * `SubscriptionPanelAutoRenewRow`. Posting `{ enabled: false }`
 * flips Stripe's `cancel_at_period_end` to `true`; `{ enabled:
 * true }` undoes it. The user keeps Pro through the current
 * period either way — this is "cancel at period end," not
 * immediate cancellation.
 */
billingRouter.post('/auto-renew', requireAuth, async (req, res, next) => {
  try {
    const { enabled } = autoRenewBody.parse(req.body ?? {});
    const data = await setAutoRenew({ userId: req.userId!, enabled });
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
});
