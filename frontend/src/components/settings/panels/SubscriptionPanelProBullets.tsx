import { Check } from 'lucide-react';

/**
 * "Pro also includes" feature list under the usage bars. Carries
 * the Pro-only differentiators that can't be expressed as a daily
 * cap (model upgrades, long-form, priority during load).
 *
 * Source-of-truth note: bullets come from the backend plans
 * registry (`PLANS.pro.bullets`) — they're not hand-rolled here.
 * That was the failure mode of the old FEATURE_SWAPS pattern:
 * marketing copy drifted from real backend caps. Adding a new
 * Pro feature is a one-line change in `backend/src/modules/
 * billing/plans.ts` and it flows through here automatically.
 *
 * Hidden when the user is already Pro — the value-prop copy
 * doesn't apply once they've converted. The portal section
 * downstream handles their "what do I get?" curiosity.
 */
interface ProBulletsProps {
  bullets: string[];
}

export function SubscriptionPanelProBullets({ bullets }: ProBulletsProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-muted text-caption tracking-wider uppercase">Pro also includes</p>
      <ul className="flex flex-col gap-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-control flex items-start gap-2 normal-case">
            <Check className="text-blurple mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="text-ink-muted">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
