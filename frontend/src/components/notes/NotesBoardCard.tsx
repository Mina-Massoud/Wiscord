import { FileText } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { funnyTitle } from '@/lib/funny-title';
import { NotesThumbnail } from './NotesBoardCardNotesThumbnail';

interface NotesBoardCardProps {
  channelId: string;
  updatedAt: string;
  onOpen: () => void;
}

/**
 * One notes-doc tile in the labs index grid. Mirrors
 * `WhiteboardBoardCard` so the index pages feel like siblings — a
 * faint surface, a colored hue blob, and a small "Edited 5m ago"
 * footer. The thumbnail is a ruled-paper pattern so the card visually
 * says "this is text" without needing a screenshot of the actual content.
 */
export function NotesBoardCard({
  channelId,
  updatedAt,
  onOpen,
}: NotesBoardCardProps): React.JSX.Element {
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
        aria-label={`Open notes ${title}`}
      >
        <NotesThumbnail hue={hue} />
        <div className="flex flex-col gap-1 px-4 py-3">
          <span className="flex items-center gap-2">
            <FileText className="text-ink-muted size-3.5 shrink-0" aria-hidden />
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
