import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { toast } from '@/lib/toast';
import { qk } from '@/queries/keys';

/**
 * Watches for the `?checkout=success` / `?checkout=cancelled` query strings
 * we hand to Stripe Checkout via `success_url` / `cancel_url`. On detect:
 *   - invalidates the subscription query so the panel refreshes
 *   - toasts the user
 *   - strips the param so reloading the page doesn't re-trigger
 *
 * Mount once at the App root inside the authed scope.
 */
export function CheckoutReturnHandler(): null {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('checkout');
    if (status !== 'success' && status !== 'cancelled') return;

    if (status === 'success') {
      void qc.invalidateQueries({ queryKey: qk.billing.root });
      toast.success('Welcome to Wiscord Pro 🎉');
    } else {
      toast.info('Checkout cancelled — no charge made.');
    }

    params.delete('checkout');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate, qc]);

  return null;
}
