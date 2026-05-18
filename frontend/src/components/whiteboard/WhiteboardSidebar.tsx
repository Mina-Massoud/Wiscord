import { Pencil } from 'lucide-react';

import { RecencySidebar } from '@/components/ui/recency-sidebar';
import type { WhiteboardSummary } from '@/types/whiteboard';
import { WhiteboardRow } from './WhiteboardSidebarWhiteboardRow';

interface WhiteboardSidebarProps {
  boards: WhiteboardSummary[];
  isLoading: boolean;
  isError: boolean;
  activeChannelId?: string;
  onOpen: (channelId: string) => void;
  onCreate: () => void;
}

/**
 * Sidebar that powers the Whiteboard labs surfaces. A thin composition
 * over `RecencySidebar` — only the row rendering is feature-specific.
 * The shell, header, CTA, grouping, and async branches live in the
 * primitive so the labs sidebars stay in lockstep.
 */
export function WhiteboardSidebar({
  boards,
  isLoading,
  isError,
  activeChannelId,
  onOpen,
  onCreate,
}: WhiteboardSidebarProps) {
  return (
    <RecencySidebar<WhiteboardSummary>
      headerIcon={<Pencil className="text-ink-muted size-3.5" aria-hidden />}
      headerTitle="Whiteboards"
      ctaLabel="New whiteboard"
      onCreate={onCreate}
      items={boards}
      getId={(board) => board.channelId}
      getUpdatedAt={(board) => board.updatedAt}
      activeId={activeChannelId}
      isLoading={isLoading}
      isError={isError}
      emptyMessage="No boards yet."
      errorMessage="Couldn't load boards."
      renderRow={(board, selected) => (
        <WhiteboardRow board={board} selected={selected} onOpen={() => onOpen(board.channelId)} />
      )}
    />
  );
}
