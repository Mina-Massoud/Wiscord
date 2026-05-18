import { Router } from 'express';

import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { ok } from '../../lib/response.js';

import { computeBillingMetrics } from './billing-metrics.js';

export const adminRouter: Router = Router();

/**
 * GET /admin/billing-metrics
 * Founder-only view of plan economics. See `BillingMetrics` shape
 * for what's returned. Reads only — no mutation surface.
 *
 * NOT designed for high-frequency polling. The aggregations are
 * cheap at current scale but get expensive past ~100k usage rows.
 * When that hurts, add a daily-rollup collection populated by a
 * cron and serve from that.
 */
adminRouter.get('/billing-metrics', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const metrics = await computeBillingMetrics();
    res.json(ok(metrics));
  } catch (err) {
    next(err);
  }
});
