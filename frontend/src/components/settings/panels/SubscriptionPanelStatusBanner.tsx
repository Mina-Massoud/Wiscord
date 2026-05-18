import { type Subscription } from '@/queries/billing';
import { AlertCircle } from 'lucide-react';

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

export function StatusBanner({ sub }: { sub: Subscription }): React.JSX.Element | null {
  if (sub.status === 'past_due') {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive mt-4 flex items-start gap-3 rounded-md border px-4 py-3">
        <AlertCircle className="size-5 shrink-0" aria-hidden />
        <div className="text-control leading-tight">
          Your last payment failed. Open the billing portal to update your card before access stops.
        </div>
      </div>
    );
  }
  if (sub.status === 'canceled' && sub.currentPeriodEnd) {
    return (
      <div className="bg-surface-1 text-ink-muted mt-4 flex items-start gap-3 rounded-md border border-white/5 px-4 py-3">
        <AlertCircle className="size-5 shrink-0" aria-hidden />
        <div className="text-control leading-tight">
          Your Pro access ends on {formatDate(sub.currentPeriodEnd)}. Resubscribe any time from the
          billing portal.
        </div>
      </div>
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
