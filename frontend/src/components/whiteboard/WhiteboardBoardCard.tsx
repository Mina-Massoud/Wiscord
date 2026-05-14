import { Pencil } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { funnyTitle } from '@/lib/funny-title';

interface WhiteboardBoardCardProps {
  channelId: string;
  updatedAt: string;
  onOpen: () => void;
}

/**
 * One board tile in the labs index grid. The preview is a synthesized
 * dot-grid mirroring the live tldraw canvas background — we don't have
 * thumbnails yet, but reusing the canvas visual language makes the
 * card read as "this is a whiteboard" without an icon-fest. A faint
 * deterministic blob sits behind the dots so every card feels unique
 * instead of stamped from a template.
 */
export function WhiteboardBoardCard({
  channelId,
  updatedAt,
  onOpen,
}: WhiteboardBoardCardProps): React.JSX.Element {
  const title = funnyTitle(channelId);
  const hue = hashHue(channelId);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'group bg-glass-surface-1 border-glass-border hover:border-glass-border-strong',
          'flex h-full w-full flex-col overflow-hidden rounded-xl border text-left',
          'shadow-glass duration-base transition-all ease-out',
          'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
        aria-label={`Open whiteboard ${title}`}
      >
        <BoardThumbnail hue={hue} />
        <div className="flex flex-col gap-1 px-4 py-3">
          <span className="flex items-center gap-2">
            <Pencil className="text-ink-muted size-3.5 shrink-0" aria-hidden />
            <span className="text-ink text-control truncate font-semibold">{title}</span>
          </span>
          <span className="text-ink-subtle text-caption">Edited {formatRelative(updatedAt)}</span>
        </div>
      </button>
    </li>
  );
}

interface BoardThumbnailProps {
  hue: number;
}

/**
 * Faint dot-grid surface with a soft hue blob behind it. Pure CSS,
 * no canvas, so the card stays cheap to render at any list size.
 */
function BoardThumbnail({ hue }: BoardThumbnailProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'relative h-32 w-full overflow-hidden',
        'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_30%,var(--tw-gradient-stops))]',
      )}
      style={{
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        backgroundColor: 'oklch(22% 0.02 280)',
      }}
    >
      <span
        className="absolute -top-10 -left-10 size-40 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: `oklch(60% 0.18 ${hue})` }}
      />
      <span
        className="absolute -right-12 -bottom-12 size-36 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: `oklch(55% 0.2 ${(hue + 140) % 360})` }}
      />
    </div>
  );
}

function hashHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
