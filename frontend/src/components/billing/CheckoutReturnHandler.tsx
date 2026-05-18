import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  POST_CHECKOUT_VERIFY_BUDGET_MS,
  usePostCheckoutVerify,
} from '@/lib/post-checkout-verify-store';
import { toast } from '@/lib/toast';
import { useSubscription } from '@/queries/billing';
import { qk } from '@/queries/keys';

/**
 * Watches for the `?checkout=success` / `?checkout=cancelled` query
 * strings we hand to Stripe Checkout via `success_url` / `cancel_url`.
 *
 * On `?checkout=success`:
 *   - Opens a verification window in `usePostCheckoutVerify` so
 *     `useSubscription` starts polling every 1.5s
 *   - Toasts "Activating Wiscord Pro…" so the user isn't met with a
 *     "Welcome to Pro" toast while the panel still says Free
 *   - When the next poll returns `tier: 'pro'`, closes the window and
 *     toasts the final "Welcome to Wiscord Pro 🎉"
 *   - If the 30s budget elapses without a tier flip (rare: webhook
 *     down or signature mismatch), closes the window and toasts a
 *     "received — refresh if it doesn't appear" fallback
 *
 * On `?checkout=cancelled`: no verification, just an info toast.
 *
 * Mount once at the App root inside the authed scope.
 */
export function CheckoutReturnHandler(): null {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const verifyStartedAt = usePostCheckoutVerify((s) => s.startedAt);
  const startVerifying = usePostCheckoutVerify((s) => s.start);
  const stopVerifying = usePostCheckoutVerify((s) => s.stop);
  const { data: subscription } = useSubscription();

  // Detect the redirect-back query param. Strip it from the URL after
  // handling so a reload doesn't re-trigger the flow.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('checkout');
    if (status !== 'success' && status !== 'cancelled') return;

    if (status === 'success') {
      startVerifying();
      void qc.invalidateQueries({ queryKey: qk.billing.root });
      toast.info('Activating Wiscord Pro…');
    } else {
      toast.info('Checkout cancelled — no charge made.');
    }

    params.delete('checkout');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate, qc, startVerifying]);

  // Watch for the tier flip while verifying. The 1.5s `refetchInterval`
  // on `useSubscription` keeps the data fresh; this effect just reacts
  // to the change so we can close the window and toast success.
  useEffect(() => {
    if (verifyStartedAt === null) return;
    if (subscription?.tier !== 'pro') return;
    stopVerifying();
    toast.success('Welcome to Wiscord Pro 🎉');
  }, [verifyStartedAt, subscription?.tier, stopVerifying]);

  // Budget-exceeded fallback. If the webhook still hasn't landed
  // after 30s, give the user an actionable hint rather than leaving
  // them staring at "Activating…" forever. The check inside the
  // timeout guards against the success path having already closed
  // the window (in which case this is a no-op).
  useEffect(() => {
    if (verifyStartedAt === null) return;
    const elapsed = Date.now() - verifyStartedAt;
    const remaining = Math.max(0, POST_CHECKOUT_VERIFY_BUDGET_MS - elapsed);
    const timer = setTimeout(() => {
      const current = usePostCheckoutVerify.getState().startedAt;
      if (current !== verifyStartedAt) return;
      stopVerifying();
      toast.info("Payment received — Pro should appear in a minute. Refresh if it doesn't.");
    }, remaining);
    return () => clearTimeout(timer);
  }, [verifyStartedAt, stopVerifying]);

  return null;
}
