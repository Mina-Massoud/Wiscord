import { Timer, Volume2, NotebookPen, MessageCircleQuestion } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { FakeTipHint, FeatureSpotlightIcon } from '@/data/fake-shell.types';

interface TipChipsProps {
  tips: FakeTipHint[];
}

const ICONS: Record<FeatureSpotlightIcon, typeof Timer> = {
  timer: Timer,
  voice: Volume2,
  notes: NotebookPen,
  // `MessageCircleQuestion` (not Sparkles) — this chip is a tip ABOUT the AI,
  // not the AI surface itself. See icon-discipline rule in frontend/CLAUDE.md.
  ai: MessageCircleQuestion,
};

const TONES: Record<FeatureSpotlightIcon, string> = {
  timer: 'text-blurple',
  voice: 'text-presence-online',
  notes: 'text-ink',
  ai: 'text-blurple',
};

/**
 * Inline pill row of feature shortcuts. Deliberately not a card grid — the
 * friends pane already has the friends list as its primary content; this
 * row reads as "things you can try," not "look at our features." Each chip
 * is decorative in v1 (see docs/overview.md on the pure-static decision).
 */
export function TipChips({ tips }: TipChipsProps): React.JSX.Element | null {
  if (tips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ink-subtle text-badge mr-1 font-semibold tracking-wider uppercase">
        Try
      </span>
      {tips.map((tip) => {
        const Icon = ICONS[tip.icon];
        const tone = TONES[tip.icon];
        return (
          <span
            key={tip.id}
            className="bg-glass-surface-2 border-glass-border text-ink-muted hover:bg-glass-hover hover:text-ink hover:border-glass-border-strong text-control rounded-pill inline-flex items-center gap-1.5 border px-3 py-1.5 transition-colors"
          >
            <Icon className={cn('size-3.5', tone)} aria-hidden />
            {tip.title}
          </span>
        );
      })}
    </div>
  );
}
