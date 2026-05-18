import Stripe from 'stripe';
import { env } from '../../lib/env.js';
import { AppError } from '../../lib/errors.js';

let cached: Stripe | null = null;

/**
 * Lazy-initialized Stripe client. Throws a 503-shaped AppError if
 * STRIPE_SECRET_KEY isn't configured — billing routes call this so an
 * unconfigured dev environment surfaces a clear error instead of crashing
 * the whole server at boot.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'billing_not_configured', 'Billing is not configured on this server.');
  }
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin the API version so feature drift in Stripe doesn't quietly change
    // the webhook payload shape. Matches the SDK's bundled `LatestApiVersion`.
    apiVersion: '2026-04-22.dahlia',
  });
  return cached;
}
