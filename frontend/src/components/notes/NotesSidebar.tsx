import { FileText } from 'lucide-react';

import { RecencySidebar } from '@/components/ui/recency-sidebar';
import type { NotesSummary } from '@/types/notes';
import { NotesRow } from './NotesSidebarNotesRow';

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
