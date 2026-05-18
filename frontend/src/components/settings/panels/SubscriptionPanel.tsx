import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePostCheckoutVerify } from '@/lib/post-checkout-verify-store';
import { toast } from '@/lib/toast';
import { useOpenPortal, usePlans, useStartCheckout, useSubscription } from '@/queries/billing';

import { SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { StatusBanner } from './SubscriptionPanelStatusBanner';
import { SubscriptionPanelAutoRenewRow } from './SubscriptionPanelAutoRenewRow';
import { SubscriptionPanelProBullets } from './SubscriptionPanelProBullets';
import { SubscriptionPanelUsageBars } from './SubscriptionPanelUsageBars';

/**
 * Subscription panel — single source of truth for plan state.
 *
 * Redesigned from the old "compare matrix with arrow rows"
 * pattern because users reported "free feels unlimited" — the
 * old layout (`messages 30/day → no cap`) read as a feature list
 * rather than a felt constraint, and the displayed Free caps
 * (30/day, 3/day) were fabricated marketing copy that didn't
 * match the actual backend caps (2/day, 1/day) — a trust break
 * waiting to surface as a "I paid for this and got nothing" bug.
 *
 * The new layout (per Mobbin reference: Glide, Dub, Apollo,
 * Base44, Vercel) is usage-bar-as-cap:
 *   - Each enforced cap renders as a live progress bar showing
 *     today's actual count against the cap. A half-filled bar
 *     can't read as "unlimited."
 *   - The Pro cap appears as helper text directly under each bar,
 *     making the value-prop one glance away from the felt limit.
 *   - The "Pro also includes" list at the bottom carries the
 *     uncapped differentiators (model upgrades, long-form notes).
 *   - Both the caps and the bullets come from `/billing/plans`,
 *     not from a hand-rolled FEATURE_SWAPS const — adding a new
 *     tier flows through automatically.
 */
export function SubscriptionPanel(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useSubscription();
  const { data: plans } = usePlans();
  const checkout = useStartCheckout();
  const portal = useOpenPortal();
  // True for the ~few seconds between a successful Stripe Checkout
  // and the `customer.subscription.created` webhook landing. While
  // this is true we replace the upgrade CTA with an "Activating…"
  // chip so the user isn't shown a contradiction (toast says Pro,
  // panel says Free + upgrade $9). The poll on `useSubscription`
  // closes this within ~1.5s of the webhook arriving.
  const isVerifyingCheckout = usePostCheckoutVerify((s) => s.startedAt !== null);

  function handleUpgrade(): void {
    checkout.mutate('/app', {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : "couldn't open checkout. try again?";
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
        const message =
          err instanceof Error ? err.message : "couldn't open the billing portal. try again?";
        toast.error(message);
      },
    });
  }

  if (isLoading) {
    return (
      <div>
        <SettingsPanelTitle>Subscription</SettingsPanelTitle>
        <div className="mt-8 flex flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <SettingsPanelTitle>Subscription</SettingsPanelTitle>
        <div className="mt-8 flex flex-col items-start gap-3">
          <p className="text-destructive text-control">
            couldn&apos;t load your subscription. try again?
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            try again
          </Button>
        </div>
      </div>
    );
  }

  const isPro = data.tier === 'pro';
  const showVerifyingState = isVerifyingCheckout && !isPro;
  const priceLine = formatPriceLine(plans?.[isPro ? 'pro' : 'free']?.priceCents);

  return (
    <div>
      <SettingsPanelTitle>Subscription</SettingsPanelTitle>

      <SettingsSection
        title={showVerifyingState ? 'Activating Pro…' : isPro ? 'You’re on Pro' : 'You’re on Free'}
      >
        <div className="flex flex-col gap-5">
          <PlanHeader isPro={isPro} priceLine={priceLine} />
          <SubscriptionPanelUsageBars isPro={isPro} />
          {!isPro && plans?.pro.bullets.length ? (
            <SubscriptionPanelProBullets bullets={plans.pro.bullets} />
          ) : null}
          {showVerifyingState ? (
            <Button size="lg" className="w-full" disabled>
              Activating Pro…
            </Button>
          ) : !isPro ? (
            <Button
              size="lg"
              className="w-full"
              onClick={handleUpgrade}
              disabled={checkout.isPending}
            >
              {checkout.isPending ? 'opening…' : 'upgrade · $9/mo'}
            </Button>
          ) : null}
          <StatusBanner sub={data} />
        </div>
      </SettingsSection>

      {isPro ? (
        <SettingsSection
          title="Manage subscription"
          description="Toggle auto-renew, switch payment method, or download an invoice."
        >
          <div className="flex flex-col gap-3">
            <SubscriptionPanelAutoRenewRow sub={data} />
            <Button variant="outline" onClick={handleManage} disabled={portal.isPending}>
              {portal.isPending ? 'opening…' : 'open billing portal'}
            </Button>
          </div>
        </SettingsSection>
      ) : showVerifyingState ? (
        <p className="text-ink-subtle text-caption mt-6 text-center normal-case">
          confirming with stripe · usually takes a few seconds
        </p>
      ) : (
        <p className="text-ink-subtle text-caption mt-6 text-center normal-case">
          cancel anytime · secure checkout via stripe
        </p>
      )}
    </div>
  );
}

/**
 * Top strip showing the active plan + price. Single confident
 * statement of who-and-what — keeps the panel header light so
 * the load-bearing content (the usage bars) sits at eye level.
 */
function PlanHeader({
  isPro,
  priceLine,
}: {
  isPro: boolean;
  priceLine: { amount: string; suffix: string } | null;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-ink text-display leading-none font-bold">
        {priceLine?.amount ?? (isPro ? '$9' : '$0')}
      </span>
      <span className="text-ink-muted text-control normal-case">
        {priceLine?.suffix ?? (isPro ? '/month' : 'forever')}
      </span>
      <span className="flex-1" />
      <span
        className={`text-badge rounded-full px-2 py-1 font-semibold tracking-[0.16em] uppercase ${
          isPro ? 'bg-blurple/15 text-blurple' : 'bg-surface-2 text-ink-muted'
        }`}
      >
        {isPro ? 'Pro' : 'Free'}
      </span>
    </div>
  );
}

/**
 * Format the price into `{ amount, suffix }` so the header can
 * render `$9` big and `/month` small. `0` cents → "$0 / forever"
 * (no recurring suffix is honest for a free plan). Returns `null`
 * when the plans response hasn't loaded yet — the caller falls
 * back to a sensible hardcoded default so the skeleton is brief.
 */
function formatPriceLine(cents: number | undefined): { amount: string; suffix: string } | null {
  if (cents === undefined) return null;
  if (cents === 0) return { amount: '$0', suffix: 'forever' };
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return { amount: `$${dollars}`, suffix: '/month' };
}
