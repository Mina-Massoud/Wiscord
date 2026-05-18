import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface FriendsEmptyStateProps {
  title: string;
  body: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

/**
 * Empty-state slab for the Friends list. The sleepy graduation-cap mascot
 * does the visual heavy lifting; copy lives in the registry so the genz
 * voice can swap it. CTA is optional — the Online tab skips it because the
 * answer to "no one is studying" isn't "add more friends".
 */
export function FriendsEmptyState({
  title,
  body,
  ctaLabel,
  onCtaClick,
}: FriendsEmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <img
        src="/logo/sleepy.webp"
        alt=""
        width={144}
        height={144}
        className="size-36 opacity-70"
        loading="lazy"
        aria-hidden
      />
      <h3 className="text-ink text-subhead mt-4 font-semibold">{title}</h3>
      <p className="text-ink-muted text-control mt-2 max-w-sm">{body}</p>
      {ctaLabel && onCtaClick ? (
        <Button onClick={onCtaClick} className="mt-5 gap-1.5">
          <UserPlus className="size-4" />
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
