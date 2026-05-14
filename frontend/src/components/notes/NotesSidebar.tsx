import { useMemo } from 'react';
import { FileText, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
 * Sidebar that powers the Notes labs surfaces. Mirrors the shape of
 * `QuizSidebar` (header, primary CTA, grouped list with selection
 * state) so the labs shell feels consistent. Used by both the index
 * page (no active selection) and the lab page (the URL's `:channelId`
 * is the active row), so jumping between docs is a single click.
 *
 * Items are grouped by recency — Today / Yesterday / This week /
 * Older — which is what people scan for when picking up a doc they
 * touched recently.
 */
export function NotesSidebar({
  docs,
  isLoading,
  isError,
  activeChannelId,
  onOpen,
  onCreate,
}: NotesSidebarProps): React.JSX.Element {
  const groups = useMemo(() => groupByRecency(docs), [docs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-glass-border h-app-titlebar flex shrink-0 items-center gap-2 border-b px-3">
        <FileText className="text-ink-muted size-3.5" aria-hidden />
        <span className="text-ink text-control font-semibold">Notes</span>
      </header>

      <div className="px-3 pt-3">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full justify-start"
          onClick={onCreate}
        >
          <Plus className="mr-2 size-4" aria-hidden />
          New notes
        </Button>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-3 overflow-auto px-2 pb-3">
        {isLoading && <SidebarSkeleton />}

        {isError && !isLoading && (
          <p className="text-ink-muted text-caption px-2 py-2">Couldn&apos;t load notes.</p>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <p className="text-ink-muted text-caption px-2 py-2">No notes yet.</p>
        )}

        {!isLoading &&
          !isError &&
          groups.map((group) => (
            <NotesGroup
              key={group.label}
              group={group}
              activeChannelId={activeChannelId}
              onOpen={onOpen}
            />
          ))}
      </div>
    </div>
  );
}

interface NotesGroupProps {
  group: RecencyGroup;
  activeChannelId?: string;
  onOpen: (channelId: string) => void;
}

function NotesGroup({ group, activeChannelId, onOpen }: NotesGroupProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1">
      <span className="text-ink-subtle text-badge px-2 py-1 font-semibold tracking-wider uppercase">
        {group.label}
      </span>
      {group.docs.map((doc) => (
        <NotesRow
          key={doc.channelId}
          doc={doc}
          selected={doc.channelId === activeChannelId}
          onOpen={() => onOpen(doc.channelId)}
        />
      ))}
    </section>
  );
}

interface NotesRowProps {
  doc: NotesSummary;
  selected: boolean;
  onOpen: () => void;
}

function NotesRow({ doc, selected, onOpen }: NotesRowProps): React.JSX.Element {
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

function SidebarSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-2 px-1.5 py-2">
          <Skeleton className="mt-1.5 size-1.5 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Grouping ────────────────────────────────────────────────────────────────

interface RecencyGroup {
  label: string;
  docs: NotesSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bucket docs by how recently they were edited. Buckets are anchored
 * to the user's local "now" — this is render-time UI grouping, not a
 * stored field, so reloading the page after midnight re-buckets
 * correctly.
 */
export function groupByRecency(docs: NotesSummary[], anchor: Date = new Date()): RecencyGroup[] {
  const startOfToday = new Date(anchor);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday.getTime() - DAY_MS);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * DAY_MS);

  const today: NotesSummary[] = [];
  const yesterday: NotesSummary[] = [];
  const thisWeek: NotesSummary[] = [];
  const older: NotesSummary[] = [];

  const sorted = [...docs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  for (const doc of sorted) {
    const updated = new Date(doc.updatedAt);
    if (Number.isNaN(updated.getTime())) {
      older.push(doc);
      continue;
    }
    if (updated >= startOfToday) today.push(doc);
    else if (updated >= startOfYesterday) yesterday.push(doc);
    else if (updated >= startOfWeek) thisWeek.push(doc);
    else older.push(doc);
  }

  const groups: RecencyGroup[] = [];
  if (today.length) groups.push({ label: 'Today', docs: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', docs: yesterday });
  if (thisWeek.length) groups.push({ label: 'This week', docs: thisWeek });
  if (older.length) groups.push({ label: 'Older', docs: older });

  return groups;
}
