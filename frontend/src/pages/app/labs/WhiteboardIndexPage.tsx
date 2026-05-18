import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Pencil, Plus, RefreshCw } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { Button } from '@/components/ui/button';
import { PaneHeader } from '@/components/ui/pane-header';
import { Skeleton } from '@/components/ui/skeleton';
import { WhiteboardBoardCard } from '@/components/whiteboard/WhiteboardBoardCard';
import { WhiteboardSidebar } from '@/components/whiteboard/WhiteboardSidebar';
import { useMyWhiteboards } from '@/queries/whiteboard';
import type { WhiteboardSummary } from '@/types/whiteboard';

/**
 * Dev-only labs index mounted at `/app/labs/whiteboard`. Lists every
 * whiteboard the caller was the most recent editor on, newest first,
 * plus a featured "New whiteboard" tile that mints a fresh UUID and
 * jumps into the canvas. Design follows the Miro/Felt board-gallery
 * pattern — featured "create" tile + uniform card grid with light
 * metadata, since channels aren't built yet and there's no folder
 * structure to surface.
 *
 * When the channels module ships this page is deleted; per-channel
 * boards will hang off the real channel route instead.
 */
export default function WhiteboardIndexPage(): React.JSX.Element {
  const navigate = useNavigate();
  const list = useMyWhiteboards();

  const boards = useMemo<WhiteboardSummary[]>(() => list.data?.boards ?? [], [list.data]);

  const goToBoard = (channelId: string): void => {
    navigate(`/app/labs/whiteboard/${channelId}`);
  };

  const createBoard = (): void => {
    goToBoard(crypto.randomUUID());
  };

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Labs · Whiteboard" />}
      serverRail={<ServerRail />}
      sidebar={
        <WhiteboardSidebar
          boards={boards}
          isLoading={list.isLoading}
          isError={list.isError}
          onOpen={goToBoard}
          onCreate={createBoard}
        />
      }
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<Pencil className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title="Whiteboards"
          subtitle={`${boards.length} ${boards.length === 1 ? 'board' : 'boards'}`}
        />
      }
      main={
        <MainPane
          boards={boards}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          onOpenBoard={goToBoard}
          onCreate={createBoard}
        />
      }
      rightRail={<ActiveNowPanel />}
    />
  );
}

// ── Main pane ───────────────────────────────────────────────────────────────

interface MainPaneProps {
  boards: WhiteboardSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenBoard: (channelId: string) => void;
  onCreate: () => void;
}

function MainPane({
  boards,
  isLoading,
  isError,
  onRetry,
  onOpenBoard,
  onCreate,
}: MainPaneProps): React.JSX.Element {
  if (isLoading) return <MainSkeleton />;
  if (isError) return <ErrorMain onRetry={onRetry} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <Hero boardCount={boards.length} onCreate={onCreate} />

      <section className="flex flex-col gap-4 px-8 pt-2 pb-10">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-ink text-subhead font-semibold">Your whiteboards</h2>
          <span className="text-ink-subtle text-caption">Most recently edited first</span>
        </header>

        {boards.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <CreateTile onCreate={onCreate} />
            {boards.map((board) => (
              <WhiteboardBoardCard
                key={board.channelId}
                channelId={board.channelId}
                updatedAt={board.updatedAt}
                onOpen={() => onOpenBoard(board.channelId)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

interface HeroProps {
  boardCount: number;
  onCreate: () => void;
}

function Hero({ boardCount, onCreate }: HeroProps): React.JSX.Element {
  return (
    <section className="px-8 pt-8 pb-6">
      <div className="bg-glass-callout border-glass-border shadow-glass relative overflow-hidden rounded-2xl border p-8">
        <span
          aria-hidden
          className="bg-blurple absolute -top-20 -right-16 size-64 rounded-full opacity-25 blur-3xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-24 -left-10 size-72 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: 'oklch(68% 0.18 320)' }}
        />
        <div className="relative flex flex-col gap-3">
          <span className="text-ink-subtle text-badge tracking-wider uppercase">
            Labs · Whiteboard
          </span>
          <h1 className="text-ink text-display max-w-2xl font-semibold">
            {boardCount === 0 ? 'Start your first whiteboard.' : 'Pick up where you left off.'}
          </h1>
          <p className="text-ink-muted text-body max-w-xl">
            Real-time canvas for sketching, sticky notes, and mind maps. Anyone with the link can
            join — cursors, shapes, and edits sync live.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onCreate}>
              <Plus className="mr-2 size-4" aria-hidden />
              New whiteboard
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Grid extras ────────────────────────────────────────────────────────────

interface CreateTileProps {
  onCreate: () => void;
}

function CreateTile({ onCreate }: CreateTileProps): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onCreate}
        className="group border-glass-border-strong hover:bg-glass-active focus-visible:ring-blurple flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label="Create a new whiteboard"
      >
        <span className="bg-blurple/10 text-blurple flex size-12 items-center justify-center rounded-full transition-transform group-hover:scale-105">
          <Plus className="size-6" aria-hidden />
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-ink text-control font-semibold">New whiteboard</span>
          <span className="text-ink-subtle text-caption">A fresh blank canvas</span>
        </span>
      </button>
    </li>
  );
}

// ── Async branches ──────────────────────────────────────────────────────────

function MainSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <section className="px-8 pt-8 pb-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
      </section>
      <section className="flex flex-col gap-4 px-8 pt-2 pb-10">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

function ErrorMain({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-ink text-body">Couldn&apos;t load your whiteboards.</p>
      <Button onClick={onRetry}>
        <RefreshCw className="mr-2 size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="border-glass-border flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <span
        aria-hidden
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
      >
        <Pencil className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-ink text-subhead font-semibold">No whiteboards yet</h3>
        <p className="text-ink-muted text-caption max-w-sm">
          Spin up a fresh canvas to start sketching ideas. Boards stay around as soon as you drop
          your first stroke.
        </p>
      </div>
      <Button type="button" onClick={onCreate}>
        <Plus className="mr-2 size-4" aria-hidden />
        New whiteboard
      </Button>
    </div>
  );
}
