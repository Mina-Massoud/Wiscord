import { Timer } from 'lucide-react';

interface FeatureSpotlightCardProps {
  title: string;
  blurb: string;
}

/**
 * Top of the right rail. Static, decorative — anchors the Wiscord
 * differentiator (the sync timer) in the showcase area when no friends
 * are active. The chip uses a low-contrast surface and a tone-tinted
 * glyph; no glow or neon (banned in docs/design.md), no card-in-card
 * nesting. Icon is the literal `Timer` — the spotlight is the sync timer.
 */
export function FeatureSpotlightCard({
  title,
  blurb,
}: FeatureSpotlightCardProps): React.JSX.Element {
  return (
    <div className="bg-glass-surface-2 border-glass-border rounded-lg border px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className="bg-surface-3 border-glass-border text-blurple flex size-9 shrink-0 items-center justify-center rounded-md border"
          aria-hidden
        >
          <Timer className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-ink text-control font-semibold">{title}</h3>
          <p className="text-ink-muted text-caption mt-0.5">{blurb}</p>
        </div>
      </div>
    </div>
  );
}
