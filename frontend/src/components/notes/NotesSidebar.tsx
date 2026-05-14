import { FileText } from 'lucide-react';

import { RecencySidebar } from '@/components/ui/recency-sidebar';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { funnyTitle } from '@/lib/funny-title';
import type { NotesSummary } from '@/types/notes';

interface NotesSidebarProps {
  docs: NotesSummary[];
  isLoading: boolean;
  isError: boolean;
  activeChannelId?: string;
  onOpen: (channelId: string) => void;
  onCreate: () => void;
}

/**
 * Sidebar that powers the Notes labs surfaces. A thin composition over
 * `RecencySidebar` — only the row rendering is feature-specific. The
 * shell, header, CTA, grouping, and async branches live in the
 * primitive so the labs sidebars stay in lockstep.
 */
export function NotesSidebar({
  docs,
  isLoading,
  isError,
  activeChannelId,
  onOpen,
  onCreate,
}: NotesSidebarProps) {
  return (
    <RecencySidebar<NotesSummary>
      headerIcon={<FileText className="text-ink-muted size-3.5" aria-hidden />}
      headerTitle="Notes"
      ctaLabel="New notes"
      onCreate={onCreate}
      items={docs}
      getId={(doc) => doc.channelId}
      getUpdatedAt={(doc) => doc.updatedAt}
      activeId={activeChannelId}
      isLoading={isLoading}
      isError={isError}
      emptyMessage="No notes yet."
      errorMessage="Couldn't load notes."
      renderRow={(doc, selected) => (
        <NotesRow doc={doc} selected={selected} onOpen={() => onOpen(doc.channelId)} />
      )}
    />
  );
}

interface NotesRowProps {
  doc: NotesSummary;
  selected: boolean;
  onOpen: () => void;
}

function NotesRow({ doc, selected, onOpen }: NotesRowProps) {
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
