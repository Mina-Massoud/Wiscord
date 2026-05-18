import { User } from '../../db/models/User.js';
import { env } from '../../lib/env.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { getStripe } from './stripe-client.js';
import type {
  CheckoutSessionResponse,
  InvoiceItem,
  PortalSessionResponse,
  SubscriptionResponse,
} from './schemas.js';

interface UserBillingShape {
  email: string;
  username: string;
  billing?: {
    stripeCustomerId?: string | null;
    subscriptionStatus?: SubscriptionResponse['status'];
    subscriptionTier?: SubscriptionResponse['tier'];
    currentPeriodEnd?: Date | null;
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
  return {
    status: billing.subscriptionStatus ?? 'none',
    tier: billing.subscriptionTier ?? 'free',
    currentPeriodEnd: billing.currentPeriodEnd ? billing.currentPeriodEnd.toISOString() : null,
    hasCustomer: !!billing.stripeCustomerId,
  };
}

/**
 * Ensure the user has a Stripe customer. Creates one lazily on first
 * Checkout / Portal invocation so we don't push every signed-up user into
 * Stripe immediately.
 */
async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripe();
  const user = await loadUser(userId);

  const existing = user.billing?.stripeCustomerId;
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId, username: user.username },
  });

  await User.findByIdAndUpdate(userId, {
    $set: { 'billing.stripeCustomerId': customer.id },
  });
  return customer.id;
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
  const user = await loadUser(userId);
  const customerId = user.billing?.stripeCustomerId;
  if (!customerId) {
    throw badRequest('billing_no_customer', 'No Stripe customer for this account yet.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function listInvoices(userId: string): Promise<InvoiceItem[]> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const customerId = user.billing?.stripeCustomerId;
  if (!customerId) return [];

  const page = await stripe.invoices.list({ customer: customerId, limit: 25 });
  return page.data.map((inv) => ({
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
}
