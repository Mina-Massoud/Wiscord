import type Stripe from 'stripe';

import { User } from '../../db/models/User.js';
import { env } from '../../lib/env.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { resolveEffectiveTier } from './effective-tier.js';
import { getStripe } from './stripe-client.js';
import type {
  CheckoutSessionResponse,
  InvoiceItem,
  PortalSessionResponse,
  SubscriptionResponse,
} from './schemas.js';

/**
 * Mongo ObjectId hex shape. We restrict the userId we interpolate into
 * the Stripe `customers.search` query to this exact pattern so a future
 * change to the User schema (or any path that lets a non-ObjectId userId
 * reach this helper) can't smuggle quote characters into the query and
 * change its semantics. Today userId is always 24 hex chars, but
 * defense-in-depth: assert it explicitly before touching Stripe.
 */
const OBJECT_ID_HEX = /^[0-9a-f]{24}$/i;

/**
 * H6 — Stripe error classifier. The Stripe SDK exposes an error
 * hierarchy where `type` identifies the family (auth, rate, network,
 * idempotency, generic API). Auth / rate / API errors mean "Stripe is
 * temporarily unreachable for us" — they must propagate as 502 so
 * callers don't render them as "you have no account" / "you have no
 * invoices" (the M9 audit gap: a transient Stripe outage looked like
 * a clean empty list).
 *
 * `resource_missing` is the only "real result, treat as not found"
 * case — handled separately at the call site.
 */
const STRIPE_UNAVAILABLE_TYPES = new Set([
  'StripeAuthenticationError',
  'StripePermissionError',
  'StripeRateLimitError',
  'StripeConnectionError',
  'StripeAPIError',
]);

function isStripeUnavailable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const type = (err as { type?: unknown }).type;
  return typeof type === 'string' && STRIPE_UNAVAILABLE_TYPES.has(type);
}

function stripeUnavailableError(): AppError {
  return new AppError(
    502,
    'billing_stripe_unavailable',
    'Billing is temporarily unavailable. Please try again in a moment.',
  );
}

interface UserBillingShape {
  email: string;
  username: string;
  billing?: {
    stripeCustomerId?: string | null;
    subscriptionId?: string | null;
    subscriptionStatus?: SubscriptionResponse['status'];
    subscriptionTier?: SubscriptionResponse['tier'];
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  };
}

async function loadUser(userId: string): Promise<UserBillingShape> {
  const user = await User.findById(userId)
    .select({ email: 1, username: 1, billing: 1 })
    .lean<UserBillingShape | null>();
  if (!user) throw notFound('user');
  return user;
}

export async function getSubscription(userId: string): Promise<SubscriptionResponse> {
  const user = await loadUser(userId);
  const billing = user.billing ?? {};
  // Route the tier through `resolveEffectiveTier` so the same H5 grace
  // logic the AI module uses (cancel-during-paid-period → still Pro,
  // past_due → still Pro) is reflected here. Without this, a user in
  // their post-cancel grace window would see "Free" + the "upgrade
  // $9/mo" CTA in Settings while `/ai/quota` correctly serves Pro
  // caps — the API would disagree with itself. Status passes through
  // raw so `SubscriptionPanelStatusBanner` can render the cancel-grace
  // / past_due / renewal banners against the literal Stripe state.
  return {
    status: billing.subscriptionStatus ?? 'none',
    tier: resolveEffectiveTier(billing),
    currentPeriodEnd: billing.currentPeriodEnd ? billing.currentPeriodEnd.toISOString() : null,
    hasCustomer: !!billing.stripeCustomerId,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd ?? false,
  };
}

/**
 * Search Stripe for a customer previously created for `userId` and
 * restore the cached id on the user doc. Used as a recovery step
 * when `billing.stripeCustomerId` is missing locally but the user
 * has subscription state suggesting Stripe has them (and just our
 * link was wiped — e.g. a stale-data cleanup script ran too late).
 *
 * Stripe's `customers.search` is eventually consistent (~30s lag
 * for newly-created customers), so a fresh signup race could miss.
 * That's acceptable here because this helper only runs as a fallback
 * after the local id is already gone — the alternative is throwing
 * billing_no_customer either way.
 */
async function recoverCustomerByMetadata(userId: string): Promise<string | null> {
  // Guard the query against any non-ObjectId userId reaching this path.
  // Stripe's search syntax uses single quotes, and an `O'Reilly`-style
  // value would silently corrupt the query — refuse to interpolate
  // anything that isn't the exact 24-hex-char shape we issue.
  if (!OBJECT_ID_HEX.test(userId)) {
    logger.warn({ userId }, 'recoverCustomerByMetadata: refusing non-ObjectId userId');
    return null;
  }
  const stripe = getStripe();
  try {
    // Limit 2 — we expect at most one match for any healthy account.
    // Pulling a second row lets us detect the duplicate case and bail
    // without picking an arbitrary winner. A duplicate means we have
    // an orphan customer in Stripe (the H1 race would have produced
    // one); resolving the right one needs a human, not a guess.
    const result = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 2,
    });
    if (result.data.length === 0) return null;
    if (result.data.length > 1) {
      logger.warn(
        { userId, matchedIds: result.data.map((c: { id: string }) => c.id) },
        'recoverCustomerByMetadata: multiple customers — refusing to pick one',
      );
      return null;
    }
    const customer = result.data[0];
    if (!customer) return null;
    await User.findByIdAndUpdate(userId, {
      $set: { 'billing.stripeCustomerId': customer.id },
    });
    return customer.id;
  } catch (err) {
    // H6 — distinguish "Stripe is broken right now" from "we
    // searched and found nothing". Auth / rate / network errors
    // must surface as 502 so the caller doesn't render them as
    // `billing_no_customer` — a user with an active sub seeing
    // "you have no Stripe customer" is worse than a clear
    // "billing temporarily unavailable" they can retry on.
    if (isStripeUnavailable(err)) {
      logger.error(
        { err, userId, errType: (err as { type?: string }).type },
        'recoverCustomerByMetadata: Stripe API unavailable — surfacing 502',
      );
      throw stripeUnavailableError();
    }
    // Any other error: log and treat as "search came up empty" so
    // the caller's no-customer fallback runs. Most likely a query-
    // syntax error from a malformed userId that slipped past the
    // regex guard above.
    logger.warn({ err, userId }, 'recoverCustomerByMetadata: search failed, treating as empty');
    return null;
  }
}

/**
 * Resolve a user's Stripe customer id from Mongo, repairing the
 * link if it's missing or stale. Two healing paths:
 *
 *   1. Cached id exists but Stripe says it's gone (resource_missing
 *      / deleted) → returns null so the caller can fall back to its
 *      own behavior (create a fresh customer, or 404).
 *   2. Cached id is missing → searches Stripe by metadata.userId for
 *      a customer we previously linked, and restores the local link
 *      if found.
 *
 * Returns `null` only when no live customer exists in Stripe at all
 * for this user — caller should either create one (checkout flow) or
 * surface a billing_no_customer error (portal / invoices flow).
 */
async function resolveLiveCustomerId(userId: string): Promise<string | null> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const cached = user.billing?.stripeCustomerId;

  if (cached) {
    try {
      const customer = await stripe.customers.retrieve(cached);
      if (!('deleted' in customer) || !customer.deleted) return cached;
    } catch (err) {
      const isMissing =
        typeof err === 'object' && err !== null && 'code' in err && err.code === 'resource_missing';
      if (!isMissing) throw err;
    }
    // Cached id is stale — clear it so the search/create path doesn't
    // get confused by it on the next call.
    await User.findByIdAndUpdate(userId, {
      $unset: { 'billing.stripeCustomerId': '' },
    });
  }

  // Try to recover by metadata before giving up. Covers the case
  // where a cleanup wiped the local id but Stripe still has the
  // customer record.
  return await recoverCustomerByMetadata(userId);
}

/**
 * Ensure the user has a Stripe customer. Creates one lazily on first
 * Checkout / Portal invocation so we don't push every signed-up user
 * into Stripe immediately.
 *
 * Self-heals through `resolveLiveCustomerId`, then creates a fresh
 * customer if no live one exists anywhere. Without this, swapping
 * STRIPE_SECRET_KEY during development hard-breaks every existing
 * user's checkout flow until someone manually wipes the field in Mongo.
 *
 * Race-safe under parallel checkout: two concurrent calls for the same
 * userId both create a customer in Stripe, but only ONE wins the atomic
 * Mongo claim. The loser deletes its orphan customer so we don't leak
 * an unreferenced record (which could grab a subscription if the user
 * happened to checkout against it before we cleaned up — that's the
 * H1 audit finding's worst-case scenario: charges land on a customer
 * we never track, refund nightmare).
 */
async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripe();
  const live = await resolveLiveCustomerId(userId);
  if (live) return live;

  const user = await loadUser(userId);

  // Create the customer in Stripe FIRST. Stripe is the irreversible
  // side-effect, so we want the in-memory result available before we
  // touch our own DB — otherwise a Mongo failure between "claim slot"
  // and "create customer" would leave a sentinel value blocking every
  // subsequent attempt forever.
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId, username: user.username },
  });

  // Atomic claim. Filter matches only when no customer id is set yet;
  // `$set` flips it to ours in the same operation. Mongo serializes
  // these updates, so under N concurrent callers exactly one's filter
  // matches and the rest see `null`.
  const claim = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { 'billing.stripeCustomerId': null },
        { 'billing.stripeCustomerId': { $exists: false } },
      ],
    },
    { $set: { 'billing.stripeCustomerId': customer.id } },
    { new: true, projection: { 'billing.stripeCustomerId': 1 } },
  ).lean<{ billing?: { stripeCustomerId?: string | null } } | null>();

  if (claim?.billing?.stripeCustomerId === customer.id) {
    return customer.id;
  }

  // We lost the race. Clean up the orphan customer we created in Stripe
  // so it can't accidentally accept a subscription we'd never see. Use
  // a best-effort delete — if it fails, log warn and continue; the
  // worst case is a dangling test-account customer with no subscription.
  await stripe.customers.del(customer.id).catch((err: unknown) => {
    logger.warn(
      { err, orphanCustomerId: customer.id, userId },
      'ensureStripeCustomer: lost race, failed to delete orphan Stripe customer',
    );
  });

  const winnerId = claim?.billing?.stripeCustomerId;
  if (!winnerId) {
    // Should be unreachable — the claim either won (we returned above)
    // or lost (meaning someone else set the id, which we'd see here).
    // If we hit this, the user doc was deleted between the create and
    // the claim, which is rare enough to surface as a 500.
    throw new AppError(
      500,
      'billing_customer_race_lost_no_winner',
      'Concurrent customer creation produced no winner — please retry.',
    );
  }
  return winnerId;
}

interface CheckoutInput {
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession({
  userId,
  successUrl,
  cancelUrl,
}: CheckoutInput): Promise<CheckoutSessionResponse> {
  if (!env.STRIPE_PRICE_PRO_MONTHLY) {
    throw badRequest('billing_price_unconfigured', 'Pro plan price ID is not configured.');
  }
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(userId);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: { userId },
  });

  if (!session.url) {
    throw new AppError(502, 'billing_session_no_url', 'Stripe did not return a session URL.');
  }
  return { url: session.url };
}

interface PortalInput {
  userId: string;
  returnUrl: string;
}

export async function createPortalSession({
  userId,
  returnUrl,
}: PortalInput): Promise<PortalSessionResponse> {
  const stripe = getStripe();
  // resolveLiveCustomerId handles both stale-id and missing-id paths
  // — if the cached customer is alive we use it, if it's dead we
  // clear it, if it's missing we search Stripe by metadata.userId
  // to recover. Only then do we 400 with billing_no_customer.
  const customerId = await resolveLiveCustomerId(userId);
  if (!customerId) {
    throw badRequest('billing_no_customer', 'No Stripe customer for this account yet.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Flip Stripe's `cancel_at_period_end` flag for this user's active
 * subscription. Powers the in-app auto-renew toggle.
 *
 *   - `enabled: false` → schedule cancellation at period end. User
 *     keeps Pro until `currentPeriodEnd`, then drops to Free.
 *   - `enabled: true` → undo a prior scheduled cancellation.
 *     Subscription continues renewing.
 *
 * The Stripe call is the source of truth; we write our own copy of
 * the flag opportunistically (faster UI than waiting for the
 * `customer.subscription.updated` webhook to fire). Webhook
 * idempotency means re-applying the same value when it does arrive
 * is a no-op.
 *
 * Why we don't expose immediate cancellation here: Stripe's
 * `subscriptions.cancel` is irreversible; if a user fat-fingers
 * the toggle, "cancel at period end" still lets them undo
 * without a re-checkout. The Portal handles the irreversible
 * variant.
 */
export async function setAutoRenew({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}): Promise<{ enabled: boolean; currentPeriodEnd: string | null }> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const subscriptionId = user.billing?.subscriptionId;
  if (!subscriptionId) {
    throw badRequest('billing_no_subscription', 'No active subscription on this account.');
  }

  let updated: Stripe.Subscription;
  try {
    updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: !enabled,
    });
  } catch (err) {
    if (isStripeUnavailable(err)) {
      logger.error(
        { err, userId, subscriptionId, errType: (err as { type?: string }).type },
        'setAutoRenew: Stripe API unavailable — surfacing 502',
      );
      throw stripeUnavailableError();
    }
    throw err;
  }

  // Write locally so the next `useSubscription` refetch sees the
  // new state immediately, not after webhook delivery (which can
  // be a few seconds). The webhook handler will re-apply the same
  // value — idempotent.
  const periodEndTs = updated.items?.data?.[0]?.current_period_end ?? null;
  const currentPeriodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;
  await User.findByIdAndUpdate(userId, {
    $set: {
      'billing.cancelAtPeriodEnd': !enabled,
      ...(currentPeriodEnd ? { 'billing.currentPeriodEnd': currentPeriodEnd } : {}),
    },
  });

  return {
    enabled,
    currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
  };
}

export async function listInvoices(userId: string): Promise<InvoiceItem[]> {
  const stripe = getStripe();
  // Same recovery flow as the portal — a missing local customer id
  // doesn't mean the user has no Stripe history, just that the link
  // got dropped. Empty invoice list is the right response when the
  // recovery search comes up genuinely empty too.
  //
  // M9 — `resolveLiveCustomerId` now throws `billing_stripe_unavailable`
  // (via `recoverCustomerByMetadata`) when Stripe itself is the
  // problem. Let that propagate; only `null` means "genuinely no
  // customer for this user."
  const customerId = await resolveLiveCustomerId(userId);
  if (!customerId) return [];

  try {
    const page = await stripe.invoices.list({ customer: customerId, limit: 25 });
    return page.data.map((inv: Stripe.Invoice) => ({
      id: inv.id,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      status: (inv.status ?? 'draft') as InvoiceItem['status'],
      periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
      createdAt: new Date(inv.created * 1000).toISOString(),
    }));
  } catch (err) {
    // Same classification as `recoverCustomerByMetadata` — propagate
    // unavailability instead of returning [] (M9). Other errors are
    // unexpected here (the customer id is known to be valid) so let
    // them surface as 500s with full stacks.
    if (isStripeUnavailable(err)) {
      logger.error(
        { err, userId, errType: (err as { type?: string }).type },
        'listInvoices: Stripe API unavailable — surfacing 502',
      );
      throw stripeUnavailableError();
    }
    throw err;
  }
}
