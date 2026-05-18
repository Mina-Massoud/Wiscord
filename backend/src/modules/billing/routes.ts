import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../lib/env.js';
import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  listInvoices,
} from './service.js';

export const billingRouter: Router = Router();

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
