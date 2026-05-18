import { cn } from '@/lib/cn';
import { funnyTitle } from '@/lib/funny-title';
import { formatRelative } from '@/lib/date';
import type { NotesSummary } from '@/types/notes';

interface NotesRowProps {
  doc: NotesSummary;
  selected: boolean;
  onOpen: () => void;
}

export function NotesRow({ doc, selected, onOpen }: NotesRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group hover:bg-surface-hover flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
        selected && 'bg-surface-active hover:bg-surface-active',
      )}
    >
      <span aria-hidden className="bg-blurple mt-1.5 size-1.5 shrink-0 rounded-full opacity-70" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-tab truncate">{funnyTitle(doc.channelId)}</span>
        <span className="text-ink-subtle text-badge">{formatRelative(doc.updatedAt)}</span>
      </span>
    </button>
  );
}
