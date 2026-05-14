import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Plus, RefreshCw } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { UserPanel } from '@/components/app-shell/UserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { Button } from '@/components/ui/button';
import { PaneHeader } from '@/components/ui/pane-header';
import { Skeleton } from '@/components/ui/skeleton';
import { NotesBoardCard } from '@/components/notes/NotesBoardCard';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { useMyNotes } from '@/queries/notes';
import type { NotesSummary } from '@/types/notes';

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
      userPanel={<UserPanel />}
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

interface MainPaneProps {
  docs: NotesSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenDoc: (channelId: string) => void;
  onCreate: () => void;
}

function MainPane({
  docs,
  isLoading,
  isError,
  onRetry,
  onOpenDoc,
  onCreate,
}: MainPaneProps): React.JSX.Element {
  if (isLoading) return <MainSkeleton />;
  if (isError) return <ErrorMain onRetry={onRetry} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <Hero docCount={docs.length} onCreate={onCreate} />

      <section className="flex flex-col gap-4 px-8 pt-2 pb-10">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-ink text-subhead font-semibold">Your notes</h2>
          <span className="text-ink-subtle text-caption">Most recently edited first</span>
        </header>

        {docs.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <CreateTile onCreate={onCreate} />
            {docs.map((doc) => (
              <NotesBoardCard
                key={doc.channelId}
                channelId={doc.channelId}
                updatedAt={doc.updatedAt}
                onOpen={() => onOpenDoc(doc.channelId)}
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
  docCount: number;
  onCreate: () => void;
}

function Hero({ docCount, onCreate }: HeroProps): React.JSX.Element {
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
          style={{ backgroundColor: 'oklch(68% 0.18 200)' }}
        />
        <div className="relative flex flex-col gap-3">
          <span className="text-ink-subtle text-badge tracking-wider uppercase">Labs · Notes</span>
          <h1 className="text-ink text-display max-w-2xl font-semibold">
            {docCount === 0 ? 'Start your first notes doc.' : 'Pick up where you left off.'}
          </h1>
          <p className="text-ink-muted text-body max-w-xl">
            Live markdown scratchpad for the channel. Type, paste, link, format — every keystroke
            syncs to everyone else in real time. No save button, no lost edits.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onCreate}>
              <Plus className="mr-2 size-4" aria-hidden />
              New notes
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
        aria-label="Create a new notes doc"
      >
        <span className="bg-blurple/10 text-blurple flex size-12 items-center justify-center rounded-full transition-transform group-hover:scale-105">
          <Plus className="size-6" aria-hidden />
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-ink text-control font-semibold">New notes</span>
          <span className="text-ink-subtle text-caption">A fresh blank page</span>
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
      <p className="text-ink text-body">Couldn&apos;t load your notes.</p>
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
        <FileText className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-ink text-subhead font-semibold">No notes yet</h3>
        <p className="text-ink-muted text-caption max-w-sm">
          Spin up a fresh page to start writing. Docs show up here as soon as you type a character.
        </p>
      </div>
      <Button type="button" onClick={onCreate}>
        <Plus className="mr-2 size-4" aria-hidden />
        New notes
      </Button>
    </div>
  );
}
