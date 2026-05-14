import { Pencil } from 'lucide-react';

import { RecencySidebar } from '@/components/ui/recency-sidebar';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { funnyTitle } from '@/lib/funny-title';
import type { WhiteboardSummary } from '@/types/whiteboard';

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

interface WhiteboardRowProps {
  board: WhiteboardSummary;
  selected: boolean;
  onOpen: () => void;
}

function WhiteboardRow({ board, selected, onOpen }: WhiteboardRowProps) {
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
        <span className="text-ink text-tab truncate">{funnyTitle(board.channelId)}</span>
        <span className="text-ink-subtle text-badge">{formatRelative(board.updatedAt)}</span>
      </span>
    </button>
  );
}
