import { Switch } from '@/components/ui/switch';
import { toast } from '@/lib/toast';
import { useSetAutoRenew, type Subscription } from '@/queries/billing';

/**
 * Auto-renew toggle inside the "Manage subscription" section.
 *
 * Stripe's subscription model has `cancel_at_period_end` — the
 * standard "cancel but keep access until the period you already
 * paid for ends" semantics. Before this row existed, users had
 * to leave the app for the Stripe Billing Portal to flip it,
 * and our UI silently showed wrong copy ("Renews on …") for the
 * entire post-cancel grace window.
 *
 * The Switch maps to the human-felt question "should this renew?"
 * — that's the inverse of Stripe's flag (auto-renew on means
 * cancel_at_period_end is false). The mutation hook hides the
 * inversion so the rest of the panel works in the natural sense.
 *
 * Visible only for users with an active or trialing subscription —
 * past_due / canceled users get a different affordance (the
 * StatusBanner CTA above this row). Free users see nothing
 * (they have nothing to renew).
 */
interface AutoRenewRowProps {
  sub: Subscription;
}

export function SubscriptionPanelAutoRenewRow({
  sub,
}: AutoRenewRowProps): React.JSX.Element | null {
  const setAutoRenew = useSetAutoRenew();

  // Only renders during the "I have an active sub" window. The
  // StatusBanner already drives the past_due / canceled flows;
  // putting a Switch there would compete for attention.
  if (sub.status !== 'active' && sub.status !== 'trialing') return null;
  if (sub.tier !== 'pro') return null;

  const renewing = !sub.cancelAtPeriodEnd;

  function handleToggle(checked: boolean): void {
    setAutoRenew.mutate(checked, {
      onSuccess: () => {
        toast.success(checked ? 'Auto-renew turned on.' : 'Auto-renew turned off.');
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : "couldn't update auto-renew. try again?";
        toast.error(message);
      },
    });
  }

  const periodEndDate = sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null;

  return (
    <div className="border-glass-border bg-glass-surface-1 flex items-center gap-4 rounded-md border px-4 py-3">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-ink text-control font-medium normal-case">Auto-renew</span>
        <span className="text-ink-subtle text-caption normal-case">
          {renewing
            ? periodEndDate
              ? `Renews on ${periodEndDate} for $9`
              : 'Renews monthly for $9'
            : periodEndDate
              ? `Pro ends ${periodEndDate}. Turn back on to keep going.`
              : 'Pro will end at the current period. Turn back on to keep going.'}
        </span>
      </div>
      <Switch
        checked={renewing}
        onCheckedChange={handleToggle}
        disabled={setAutoRenew.isPending}
        aria-label="Auto-renew subscription"
      />
    </div>
  );
}

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
