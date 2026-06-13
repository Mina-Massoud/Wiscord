import { ChevronRight, Megaphone } from 'lucide-react';

interface AnnouncementBannerProps {
  /** Short uppercase pill label, e.g. "New". */
  tag: string;
  headline: string;
  tagline: string;
}

/**
 * Top-of-pane announcement. Uses a left blurple accent stripe + soft
 * blurple-tinted gradient so it reads as a designed product surface, not
 * a system notification. Icon is `Megaphone` — literal for "this is an
 * announcement." We deliberately do NOT use a magic icon (Sparkles, Wand,
 * Stars, Bot, etc.) even when the announcement's subject is an AI feature
 * — the icon belongs to the surface ("announcement"), not the subject
 * matter ("about AI"). See frontend/CLAUDE.md icon-discipline rule.
 * Decorative in v1; the chevron affords interactivity but the row is
 * not routed.
 */
export function AnnouncementBanner({
  tag,
  headline,
  tagline,
}: AnnouncementBannerProps): React.JSX.Element {
  return (
    <article className="group bg-glass-surface-2 border-glass-border hover:border-glass-border-strong relative flex items-center gap-4 overflow-hidden rounded-lg border pr-4 pl-5 transition-colors">
      <span aria-hidden className="bg-blurple absolute inset-y-0 left-0 w-1" />
      <span
        aria-hidden
        className="from-blurple/10 absolute inset-0 bg-gradient-to-r via-transparent to-transparent"
      />

      <span
        aria-hidden
        className="bg-blurple/15 text-blurple rounded-pill relative flex size-10 shrink-0 items-center justify-center"
      >
        <Megaphone className="size-5" />
      </span>

      <div className="relative flex min-w-0 flex-1 flex-col gap-1 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-blurple text-blurple-foreground text-badge rounded-pill inline-flex shrink-0 items-center px-1.5 py-0.5 font-bold tracking-wider uppercase">
            {tag}
          </span>
          <p className="text-ink text-control truncate font-semibold">{headline}</p>
        </div>
        <p className="text-ink-muted text-caption truncate">{tagline}</p>
      </div>

      <ChevronRight
        className="text-ink-muted group-hover:text-ink relative size-4 shrink-0 transition-colors"
        aria-hidden
      />
    </article>
  );
}
