import { Timer, Volume2, NotebookPen, MessageCircleQuestion } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { FeatureSpotlight, FeatureSpotlightIcon } from '@/data/fake-shell.types';

interface FeatureSpotlightCardProps {
  spotlight: FeatureSpotlight;
}

const ICONS: Record<FeatureSpotlightIcon, typeof Timer> = {
  timer: Timer,
  voice: Volume2,
  notes: NotebookPen,
  // `MessageCircleQuestion` (not Sparkles) — this card is a feature
  // spotlight, not the AI surface itself. See icon-discipline rule in
  // frontend/CLAUDE.md.
  ai: MessageCircleQuestion,
};

const CHIP_TONE: Record<FeatureSpotlightIcon, string> = {
  timer: 'text-blurple',
  voice: 'text-presence-online',
  notes: 'text-ink',
  ai: 'text-blurple',
};

/**
 * Top of the right rail. Static, decorative — anchors a Wiscord
 * differentiator in the showcase area when no friends are active.
 * The chip uses a low-contrast surface and a tone-tinted glyph; no
 * glow or neon (banned in docs/design.md), no card-in-card nesting.
 */
export function FeatureSpotlightCard({ spotlight }: FeatureSpotlightCardProps): React.JSX.Element {
  const Icon = ICONS[spotlight.icon];
  const chipTone = CHIP_TONE[spotlight.icon];

  return (
    <div className="bg-glass-surface-2 border-glass-border rounded-lg border px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'bg-surface-3 border-glass-border flex size-9 shrink-0 items-center justify-center rounded-md border',
            chipTone,
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-ink text-control font-semibold">{spotlight.title}</h3>
          <p className="text-ink-muted text-caption mt-0.5">{spotlight.blurb}</p>
        </div>
      </div>
    </div>
  );
}
