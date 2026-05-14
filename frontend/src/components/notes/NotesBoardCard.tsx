import { FileText } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { funnyTitle } from '@/lib/funny-title';

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

interface NotesThumbnailProps {
  hue: number;
}

/**
 * Ruled-paper background with a soft hue blob behind it. Pure CSS, no
 * canvas — keeps the card cheap to render at any list size.
 */
function NotesThumbnail({ hue }: NotesThumbnailProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className="relative h-32 w-full overflow-hidden"
      style={{
        backgroundImage:
          'repeating-linear-gradient(180deg, transparent 0, transparent 22px, rgba(255,255,255,0.06) 22px, rgba(255,255,255,0.06) 23px)',
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
      {/* A faint stack of placeholder text lines floating over the rules,
          so the thumbnail reads as "a written page" rather than "blank
          stationery". Widths vary deterministically by hue to keep each
          card distinct. */}
      <div className="absolute inset-0 flex flex-col gap-3 px-6 pt-6">
        <span
          className="bg-glass-border-strong h-1.5 rounded-full"
          style={{ width: `${48 + (hue % 36)}%` }}
        />
        <span
          className="bg-glass-border h-1.5 rounded-full"
          style={{ width: `${60 + (hue % 24)}%` }}
        />
        <span
          className="bg-glass-border h-1.5 rounded-full"
          style={{ width: `${36 + (hue % 32)}%` }}
        />
      </div>
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
