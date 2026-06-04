import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FileText } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/server/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';
import { PaneHeader } from '@/components/ui/pane-header';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { useMyNotes } from '@/queries/notes';
import type { NotesSummary } from '@/types/notes';
import { MainPane } from './NotesIndexPageMainPane';

/**
 * Dev-only labs index mounted at `/app/labs/notes`. Lists every notes
 * doc the caller was the most recent editor on, newest first, plus a
 * featured "New notes" tile that mints a fresh UUID and jumps into the
 * editor.
 *
 * Mirrors `WhiteboardIndexPage` so the two labs feel like siblings:
 * featured create tile + uniform card grid with light metadata. When
 * channels lands, per-channel notes hang off the real channel route
 * and this page is deleted.
 */
export default function NotesIndexPage(): React.JSX.Element {
  const navigate = useNavigate();
  const list = useMyNotes();

  const docs = useMemo<NotesSummary[]>(() => list.data?.docs ?? [], [list.data]);

  const goToDoc = (channelId: string): void => {
    navigate(`/app/labs/notes/${channelId}`);
  };

  const createDoc = (): void => {
    goToDoc(crypto.randomUUID());
  };

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Labs · Notes" />}
      serverRail={<ServerRail />}
      sidebar={
        <NotesSidebar
          docs={docs}
          isLoading={list.isLoading}
          isError={list.isError}
          onOpen={goToDoc}
          onCreate={createDoc}
        />
      }
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<FileText className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title="Notes"
          subtitle={`${docs.length} ${docs.length === 1 ? 'doc' : 'docs'}`}
        />
      }
      main={
        <MainPane
          docs={docs}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          onOpenDoc={goToDoc}
          onCreate={createDoc}
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
