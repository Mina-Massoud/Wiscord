import { AlertCircle, ArrowUpRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import {
  useOpenPortal,
  useStartCheckout,
  useSubscription,
  type Subscription,
} from '@/queries/billing';
import { SettingsPanelTitle, SettingsSection } from '../SettingsShell';

const PRO_PRICE = '$5';

const FREE_FEATURES = [
  'Daily AI study sessions',
  'Standard upload size & recordings',
  'Community voice servers',
  'Public study rooms',
];

const PRO_FEATURES = [
  'Unlimited AI study sessions',
  'Bigger uploads, longer recordings',
  'Priority voice servers',
  'Pro badge on your profile',
];

export function SubscriptionPanel(): React.JSX.Element {
  const { data, isLoading, error } = useSubscription();
  const checkout = useStartCheckout();
  const portal = useOpenPortal();

  function handleUpgrade(): void {
    checkout.mutate('/app', {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : 'Could not open checkout. Try again in a moment.';
        toast.error(message);
      },
    });
  }

  function handleManage(): void {
    portal.mutate('/app', {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Could not open the billing portal.';
        toast.error(message);
      },
    });
  }

  if (isLoading) {
    return (
      <div>
        <SettingsPanelTitle>Subscription</SettingsPanelTitle>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <SettingsPanelTitle>Subscription</SettingsPanelTitle>
        <p className="text-destructive text-control mt-8">
          Couldn&apos;t load your subscription. Try refreshing the dialog.
        </p>
      </div>
    );
  }

  const isPro = data.tier === 'pro';

  return (
    <div>
      <SettingsPanelTitle>Subscription</SettingsPanelTitle>

      <SettingsSection title="Your plan">
        <div className="grid gap-4 md:grid-cols-2">
          <TierCard
            name="Free"
            price="$0"
            cadence="forever"
            features={FREE_FEATURES}
            isCurrent={!isPro}
            isFeatured={false}
          />
          <TierCard
            name="Wiscord Pro"
            price={PRO_PRICE}
            cadence="per month"
            features={PRO_FEATURES}
            isCurrent={isPro}
            isFeatured
            cta={
              isPro
                ? null
                : {
                    label: 'Upgrade to Pro',
                    onClick: handleUpgrade,
                    isPending: checkout.isPending,
                  }
            }
          />
        </div>
        <StatusBanner sub={data} />
      </SettingsSection>

      {isPro ? (
        <SettingsSection
          title="Manage subscription"
          description="Switch payment method, change plan, or download an invoice."
        >
          <Button variant="outline" onClick={handleManage} disabled={portal.isPending}>
            {portal.isPending ? 'Opening…' : 'Open billing portal'}
          </Button>
        </SettingsSection>
      ) : (
        <p className="text-ink-subtle text-caption mt-6 text-center">
          Cancel anytime · Secure checkout via Stripe
        </p>
      )}
    </div>
  );
}

interface TierCardCta {
  label: string;
  onClick: () => void;
  isPending: boolean;
}

interface TierCardProps {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  isCurrent: boolean;
  isFeatured: boolean;
  cta?: TierCardCta | null;
}

function TierCard({
  name,
  price,
  cadence,
  features,
  isCurrent,
  isFeatured,
  cta,
}: TierCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-5 rounded-lg border p-5',
        isFeatured ? 'border-blurple/40 bg-blurple/5' : 'bg-surface-1 border-white/5',
      )}
    >
      {isFeatured ? (
        <span className="bg-blurple text-blurple-foreground text-badge absolute -top-2 right-4 rounded-full px-2 py-1 font-bold tracking-wider uppercase">
          Recommended
        </span>
      ) : null}

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={cn('text-tab font-semibold', isFeatured ? 'text-blurple' : 'text-ink-muted')}
          >
            {name}
          </h4>
          {isCurrent ? (
            <span className="text-ink-muted bg-surface-2 text-badge rounded-full px-2 py-1 font-semibold tracking-wider uppercase">
              Current
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-ink text-display leading-none font-bold">{price}</span>
          <span className="text-ink-muted text-caption">{cadence}</span>
        </div>
      </header>

      <hr className="border-white/5" />

      <ul className="flex flex-1 flex-col gap-2.5">
        {features.map((feature) => (
          <li key={feature} className="text-ink text-control flex items-start gap-2 leading-snug">
            <Check
              className={cn('mt-0.5 size-4 shrink-0', isFeatured ? 'text-blurple' : 'text-success')}
              aria-hidden
            />
            {feature}
          </li>
        ))}
      </ul>

      {cta ? (
        <Button onClick={cta.onClick} disabled={cta.isPending} size="lg" className="w-full gap-2">
          {cta.isPending ? (
            'Opening checkout…'
          ) : (
            <>
              {cta.label}
              <ArrowUpRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      ) : isCurrent ? (
        <Button variant="outline" disabled size="lg" className="w-full">
          You&apos;re on this plan
        </Button>
      ) : null}
    </div>
  );
}

function StatusBanner({ sub }: { sub: Subscription }): React.JSX.Element | null {
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
