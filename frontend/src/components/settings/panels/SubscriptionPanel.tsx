import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { useOpenPortal, useStartCheckout, useSubscription } from '@/queries/billing';
import { SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { TierCard } from './SubscriptionPanelTierCard';
import { StatusBanner } from './SubscriptionPanelStatusBanner';

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
