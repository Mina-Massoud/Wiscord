import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  isInVerifyWindow,
  POST_CHECKOUT_VERIFY_INTERVAL_MS,
  usePostCheckoutVerify,
} from '@/lib/post-checkout-verify-store';

import { api } from './client';
import { qk } from './keys';

// Mirrors the User model enum on the backend — `unpaid` and `paused`
// both render as "Free tier" in the UI but the StatusBanner can
// surface specific copy if needed. Adding them here closes the type
// drift gap where those values could escape the API typed as just
// `string` even though the backend writes them.
export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';
export type SubscriptionTier = 'free' | 'pro';

export interface Subscription {
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  /**
   * Mirrors Stripe's `subscription.cancel_at_period_end`. `true`
   * means the user has cancelled but the period hasn't elapsed
   * yet — drives the StatusBanner "Ends on …" copy and the
   * AutoRenewRow toggle's off state.
   */
  cancelAtPeriodEnd: boolean;
}

export interface Invoice {
  id: string;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string;
}

/**
 * Plan definition served by `GET /billing/plans`. The single source
 * of truth for what each tier costs, what daily caps it grants, and
 * what Pro-only features it includes. Used by SubscriptionPanel to
 * render live usage bars and the "Pro also includes" line — no
 * hand-rolled marketing copy.
 */
export interface PlanView {
  id: 'free' | 'pro';
  displayName: string;
  priceCents: number;
  quotas: {
    message: number;
    url_note: number;
  };
  bullets: string[];
}

export interface PlansResponse {
  free: PlanView;
  pro: PlanView;
}

export function useSubscription() {
  const verifyStartedAt = usePostCheckoutVerify((s) => s.startedAt);
  return useQuery({
    queryKey: qk.billing.subscription(),
    queryFn: () => api<Subscription>('/billing/subscription'),
    staleTime: 30 * 1000,
    // M1 — when the user cancels in the Stripe Portal in another tab
    // and refocuses ours, default `refetchOnWindowFocus` only fires
    // when the query is stale. Forcing `'always'` makes the panel
    // converge on the new subscription state immediately on focus.
    refetchOnWindowFocus: 'always',
    // C1 — post-checkout webhook lag closer. While the verify window
    // is open, poll every 1.5s until either the tier flips to `pro`
    // or the 30s budget elapses. The handler in `CheckoutReturnHandler`
    // closes the window the moment it observes `tier === 'pro'`, so
    // this self-stops in the happy case.
    refetchInterval: (query) => {
      if (!isInVerifyWindow(verifyStartedAt)) return false;
      if (query.state.data?.tier === 'pro') return false;
      return POST_CHECKOUT_VERIFY_INTERVAL_MS;
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: qk.billing.invoices(),
    queryFn: () => api<Invoice[]>('/billing/invoices'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: (returnPath?: string) =>
      api<{ url: string }>('/billing/checkout-session', {
        method: 'POST',
        body: returnPath ? { returnPath } : {},
      }),
  });
}

export function useOpenPortal() {
  return useMutation({
    mutationFn: (returnPath?: string) =>
      api<{ url: string }>('/billing/portal-session', {
        method: 'POST',
        body: returnPath ? { returnPath } : {},
      }),
  });
}

/**
 * Plan registry — caps + features + price. Long stale time because
 * plan definitions change at most monthly. Loaded once on first
 * Settings open and cached for the rest of the session.
 *
 * Drives `SubscriptionPanel`'s usage bars (caps come from here) and
 * the Pro feature list. Replaces the old hand-rolled FEATURE_SWAPS
 * const which drifted from backend reality (claimed `30 messages/day`
 * on Free when actual cap was 2).
 */
export function usePlans() {
  return useQuery({
    queryKey: qk.billing.plans(),
    queryFn: () => api<PlansResponse>('/billing/plans'),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Toggle Stripe's `cancel_at_period_end` flag for the caller's
 * active subscription. Powers the in-app auto-renew Switch.
 *
 * Optimistically updates the cached `Subscription` so the Switch
 * flips snappily; rolls back on error. Invalidates on settle so
 * the canonical state (including the fresh `currentPeriodEnd`
 * Stripe may return) takes effect once the request completes.
 */
export function useSetAutoRenew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api<{ enabled: boolean; currentPeriodEnd: string | null }>('/billing/auto-renew', {
        method: 'POST',
        body: { enabled },
      }),
    onMutate: async (enabled: boolean) => {
      // Optimistic update: paint the Switch in its new position
      // before the server round-trip lands. Rolled back on error.
      await qc.cancelQueries({ queryKey: qk.billing.subscription() });
      const previous = qc.getQueryData<Subscription>(qk.billing.subscription());
      if (previous) {
        qc.setQueryData<Subscription>(qk.billing.subscription(), {
          ...previous,
          cancelAtPeriodEnd: !enabled,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(qk.billing.subscription(), ctx.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.billing.subscription() });
    },
  });
}
