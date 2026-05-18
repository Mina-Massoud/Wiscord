import { Crown } from 'lucide-react';

import { MediaImg } from '@/components/ui/media-img';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { cn } from '@/lib/cn';

export interface Viewer {
  identity: string;
  name: string;
  avatarUrl?: string | null;
}

interface ViewerDotsProps {
  viewers: Viewer[];
  hostUserId: string;
  /** Maximum shown before collapsing into a `+N` chip. */
  maxVisible?: number;
}

/**
 * Edge-of-player presence affordance. Stacks viewer avatars with negative
 * margin, host gets a small crown overlay so the watcher knows who's in
 * control without scanning the host banner.
 *
 * Rendered as a horizontal row; the parent's `auto-animate` handles
 * additions/removals so newcomers don't jump in.
 */
export function ViewerDots({
  viewers,
  hostUserId,
  maxVisible = 5,
}: ViewerDotsProps): React.JSX.Element | null {
  if (viewers.length === 0) return null;

  const visible = viewers.slice(0, maxVisible);
  const overflow = viewers.length - visible.length;

  return (
    <div className="flex items-center" aria-label={`${viewers.length} viewers`}>
      {visible.map((viewer) => {
        const isHost = viewer.identity === hostUserId;
        return (
          <Tooltip key={viewer.identity}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'border-glass-shell relative -ml-2 size-6 overflow-visible rounded-full border-2 first:ml-0',
                )}
              >
                <MediaImg
                  src={viewer.avatarUrl || undefined}
                  fallbackSrc={getIdenticonDataUrl(viewer.identity)}
                  alt=""
                  className="size-full rounded-full"
                  width={24}
                  height={24}
                />
                {isHost ? (
                  <Crown
                    className="text-blurple absolute -top-1.5 -right-1.5 size-3 drop-shadow"
                    aria-hidden
                  />
                ) : null}
              </span>
            </TooltipTrigger>
            <TooltipContent>{viewer.name}</TooltipContent>
          </Tooltip>
        );
      })}
      {overflow > 0 ? (
        <span className="bg-glass-surface-1 text-ink-muted text-badge -ml-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-semibold">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
