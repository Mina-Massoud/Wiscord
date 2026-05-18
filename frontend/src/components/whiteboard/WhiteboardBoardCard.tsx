import { Pencil } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { funnyTitle } from '@/lib/funny-title';
import { BoardThumbnail } from './WhiteboardBoardCardBoardThumbnail';

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

function hashHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
