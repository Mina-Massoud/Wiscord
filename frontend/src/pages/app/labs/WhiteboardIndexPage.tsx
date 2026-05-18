import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Pencil } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';
import { PaneHeader } from '@/components/ui/pane-header';
import { WhiteboardSidebar } from '@/components/whiteboard/WhiteboardSidebar';
import { useMyWhiteboards } from '@/queries/whiteboard';
import type { WhiteboardSummary } from '@/types/whiteboard';
import { MainPane } from './WhiteboardIndexPageMainPane';

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

// ── Hero ────────────────────────────────────────────────────────────────────

// ── Grid extras ────────────────────────────────────────────────────────────

// ── Async branches ──────────────────────────────────────────────────────────
