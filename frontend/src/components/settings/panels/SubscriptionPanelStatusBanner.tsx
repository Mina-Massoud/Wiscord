import { AlertCircle } from 'lucide-react';

import { toast } from '@/lib/toast';
import { useOpenPortal, type Subscription } from '@/queries/billing';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Banner under the plan header that surfaces the most actionable
 * piece of state: payment failed (red, needs immediate attention),
 * subscription cancelled but still in grace (informational), or
 * renewal date for normal Pro.
 *
 * M6 — the past_due and canceled-grace banners now embed an action
 * (open the Stripe Billing Portal) so the user can act on the
 * banner copy without hunting for the "manage subscription" CTA
 * elsewhere on the panel. Renders as a clickable button row in
 * those two states; the renewal-date variant stays as inert text
 * since there's nothing to do.
 */
export function StatusBanner({ sub }: { sub: Subscription }): React.JSX.Element | null {
  const portal = useOpenPortal();

  function openPortal(returnPath = '/app'): void {
    portal.mutate(returnPath, {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : "couldn't open the billing portal. try again?";
        toast.error(message);
      },
    });
  }

  // active + cancelAtPeriodEnd is the post-cancel grace window:
  // user toggled off auto-renew, sub still says `active` until
  // Stripe fires `subscription.deleted` at period end. Distinct
  // from the canceled branch below (which fires after the period
  // actually elapses, or after a manual immediate cancel in the
  // Portal). Without this branch we'd render "Renews on …" for a
  // user who's about to lose access — the bug that prompted the
  // in-app auto-renew toggle.
  if (
    (sub.status === 'active' || sub.status === 'trialing') &&
    sub.cancelAtPeriodEnd &&
    sub.currentPeriodEnd
  ) {
    return (
      <div className="bg-surface-1 text-ink-muted mt-4 flex items-start gap-3 rounded-md border border-white/5 px-4 py-3">
        <AlertCircle className="size-5 shrink-0" aria-hidden />
        <div className="text-control leading-tight">
          Auto-renew is off. Your Pro access ends on {formatDate(sub.currentPeriodEnd)}.
        </div>
      </div>
    );
  }
  if (sub.status === 'past_due') {
    return (
      <button
        type="button"
        onClick={() => openPortal()}
        disabled={portal.isPending}
        className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/40 mt-4 flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        <AlertCircle className="size-5 shrink-0" aria-hidden />
        <div className="text-control flex-1 leading-tight">
          {portal.isPending ? (
            'opening billing portal…'
          ) : (
            <>
              Your last payment failed. <span className="underline">Update your card</span> before
              access stops.
            </>
          )}
        </div>
      </button>
    );
  }
  if (sub.status === 'canceled' && sub.currentPeriodEnd) {
    return (
      <button
        type="button"
        onClick={() => openPortal()}
        disabled={portal.isPending}
        className="bg-surface-1 text-ink-muted hover:bg-surface-2 focus-visible:ring-blurple/40 mt-4 flex w-full items-start gap-3 rounded-md border border-white/5 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        <AlertCircle className="size-5 shrink-0" aria-hidden />
        <div className="text-control flex-1 leading-tight">
          {portal.isPending ? (
            'opening billing portal…'
          ) : (
            <>
              Your Pro access ends on {formatDate(sub.currentPeriodEnd)}.{' '}
              <span className="text-ink underline">Resubscribe</span> any time.
            </>
          )}
        </div>
      </button>
    );
  }
  if (sub.tier === 'pro' && sub.currentPeriodEnd && sub.status !== 'canceled') {
    return (
      <p className="text-ink-subtle text-caption mt-4">
        Renews on {formatDate(sub.currentPeriodEnd)}.
      </p>
    );
  }
  return null;
}
