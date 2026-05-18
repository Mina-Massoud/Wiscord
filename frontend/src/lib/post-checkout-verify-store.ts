import { create } from 'zustand';

/**
 * Tracks the brief window after a successful Stripe Checkout where
 * the frontend has redirected back to the app but the
 * `customer.subscription.created` webhook may not have landed yet.
 *
 * Without this, the user sees the "Welcome to Pro" toast paired with
 * a "You're on Free · upgrade $9/mo" panel because `GET /billing/
 * subscription` reads from Mongo and Mongo hasn't been updated yet by
 * the webhook. That's the literal "user can't pay and see nothing"
 * bug from the subscription-UX audit.
 *
 * Lifecycle:
 *   - `CheckoutReturnHandler` calls `start()` on `?checkout=success`
 *   - `useSubscription` reads `startedAt` and adds a 1.5s
 *     `refetchInterval` while it's set
 *   - When the next refetch returns `tier: 'pro'`, the handler
 *     observes the flip and calls `stop()` + success toast
 *   - If 30s elapses without a tier flip, the handler times out and
 *     toasts a "received — refresh if it doesn't show" fallback
 *
 * Not persisted — a refresh during this window picks up wherever the
 * webhook + cache currently are; the user won't see "verifying" twice.
 */

export const POST_CHECKOUT_VERIFY_BUDGET_MS = 30_000;
/** Tick cadence for the `useSubscription` poll while verifying. */
export const POST_CHECKOUT_VERIFY_INTERVAL_MS = 1_500;

interface PostCheckoutVerifyStore {
  /** Epoch ms when verification started. `null` when not verifying. */
  startedAt: number | null;
  start: () => void;
  stop: () => void;
}

export const usePostCheckoutVerify = create<PostCheckoutVerifyStore>((set) => ({
  startedAt: null,
  start: () => set({ startedAt: Date.now() }),
  stop: () => set({ startedAt: null }),
}));

/**
 * `true` if a verification window was opened recently enough that
 * we should still be polling. Used by `useSubscription` to decide
 * whether to enable its `refetchInterval`.
 */
export function isInVerifyWindow(startedAt: number | null, now: number = Date.now()): boolean {
  if (startedAt === null) return false;
  return now - startedAt < POST_CHECKOUT_VERIFY_BUDGET_MS;
}
