import { cn } from '@/lib/cn';
import { ArrowUpRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export function TierCard({
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
