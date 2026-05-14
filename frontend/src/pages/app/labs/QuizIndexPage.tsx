import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Hash, ListChecks, Loader2 } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { UserPanel } from '@/components/app-shell/UserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useMyQuizzes } from '@/queries/quiz';
import type { Quiz, QuizStatus } from '@/types/quiz';

/**
 * Dev-only labs index mounted at `/app/labs/quiz`. Lists every quiz the
 * current user hosts, grouped by channel, so the host can jump into any of
 * their channels' workshops without having to remember a channelId.
 *
 * When the channels module ships, this page is deleted — the per-channel
 * workshop will be mounted as a tab on the real channel page.
 */
export default function QuizIndexPage(): React.JSX.Element {
  const navigate = useNavigate();
  const list = useMyQuizzes();

  const groups = useMemo(() => groupByChannel(list.data ?? []), [list.data]);

  const goToChannel = (channelId: string, quizId?: string): void => {
    const suffix = quizId ? `?quiz=${quizId}` : '';
    navigate(`/app/labs/quiz/${channelId}${suffix}`);
  };

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title="Labs · Quiz" />}
      serverRail={<ServerRail />}
      sidebar={
        <ChannelSidebar
          groups={groups}
          isLoading={list.isLoading}
          isError={list.isError}
          onSelect={(channelId) => goToChannel(channelId)}
        />
      }
      userPanel={<UserPanel />}
      topBar={
        <header className="border-glass-border h-app-titlebar flex shrink-0 items-center gap-2 border-b px-4">
          <ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden />
          <span className="text-ink text-subhead font-semibold">Quiz workshop</span>
          <span className="text-ink-subtle text-caption ml-2">
            {groups.length} {groups.length === 1 ? 'channel' : 'channels'}
          </span>
        </header>
      }
      main={
        <MainPane
          groups={groups}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          onOpenChannel={(channelId) => goToChannel(channelId)}
          onOpenQuiz={(channelId, quizId) => goToChannel(channelId, quizId)}
        />
      }
      rightRail={<ActiveNowPanel />}
    />
  );
}

// ── Grouping ────────────────────────────────────────────────────────────────

interface ChannelGroup {
  channelId: string;
  slug: string;
  quizzes: Quiz[];
  lastUpdatedAt: string;
}

function groupByChannel(quizzes: Quiz[]): ChannelGroup[] {
  const byChannel = new Map<string, Quiz[]>();
  for (const quiz of quizzes) {
    const existing = byChannel.get(quiz.channelId);
    if (existing) {
      existing.push(quiz);
    } else {
      byChannel.set(quiz.channelId, [quiz]);
    }
  }
  const groups: ChannelGroup[] = [];
  for (const [channelId, qs] of byChannel.entries()) {
    const sorted = [...qs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    groups.push({
      channelId,
      slug: channelId.slice(-6),
      quizzes: sorted,
      lastUpdatedAt: sorted[0]?.updatedAt ?? '',
    });
  }
  // Channel order: most-recently-touched first.
  groups.sort((a, b) => (a.lastUpdatedAt < b.lastUpdatedAt ? 1 : -1));
  return groups;
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

interface ChannelSidebarProps {
  groups: ChannelGroup[];
  isLoading: boolean;
  isError: boolean;
  onSelect: (channelId: string) => void;
}

function ChannelSidebar({
  groups,
  isLoading,
  isError,
  onSelect,
}: ChannelSidebarProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-glass-border h-app-titlebar flex shrink-0 items-center border-b px-4">
        <ListChecks className="text-ink-muted mr-2 size-4 shrink-0" aria-hidden />
        <span className="text-ink text-control truncate font-semibold">Labs · Quiz</span>
      </header>

      <div className="flex flex-1 flex-col gap-1 overflow-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
            Channels
          </span>
        </div>

        {isLoading && <SidebarSkeleton />}

        {isError && (
          <p className="text-ink-muted text-caption px-2 py-1">Couldn&apos;t load channels.</p>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <p className="text-ink-muted text-caption px-2 py-2">
            You haven&apos;t hosted any quizzes yet.
          </p>
        )}

        {groups.map((group) => (
          <ChannelRow
            key={group.channelId}
            group={group}
            onSelect={() => onSelect(group.channelId)}
          />
        ))}
      </div>
    </div>
  );
}

interface ChannelRowProps {
  group: ChannelGroup;
  onSelect: () => void;
}

function ChannelRow({ group, onSelect }: ChannelRowProps): React.JSX.Element {
  const count = group.quizzes.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group hover:bg-surface-hover flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors"
    >
      <Hash className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-tab truncate font-mono">{group.slug}</span>
        <span className="text-ink-subtle text-badge">
          {count} {count === 1 ? 'quiz' : 'quizzes'}
        </span>
      </span>
    </button>
  );
}

function SidebarSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2 px-1.5 py-2">
          <Skeleton className="mt-0.5 size-4 rounded" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main pane ───────────────────────────────────────────────────────────────

interface MainPaneProps {
  groups: ChannelGroup[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenChannel: (channelId: string) => void;
  onOpenQuiz: (channelId: string, quizId: string) => void;
}

function MainPane({
  groups,
  isLoading,
  isError,
  onRetry,
  onOpenChannel,
  onOpenQuiz,
}: MainPaneProps): React.JSX.Element {
  if (isLoading) return <MainSkeleton />;
  if (isError) return <ErrorMain onRetry={onRetry} />;
  if (groups.length === 0) return <EmptyMain />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-6">
      {groups.map((group) => (
        <ChannelSection
          key={group.channelId}
          group={group}
          onOpenChannel={() => onOpenChannel(group.channelId)}
          onOpenQuiz={(quizId) => onOpenQuiz(group.channelId, quizId)}
        />
      ))}
    </div>
  );
}

interface ChannelSectionProps {
  group: ChannelGroup;
  onOpenChannel: () => void;
  onOpenQuiz: (quizId: string) => void;
}

function ChannelSection({
  group,
  onOpenChannel,
  onOpenQuiz,
}: ChannelSectionProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Hash className="text-ink-muted size-4 shrink-0" aria-hidden />
          <h2 className="text-ink text-subhead truncate font-mono">{group.slug}</h2>
          <span className="text-ink-subtle text-badge">
            · {group.quizzes.length} {group.quizzes.length === 1 ? 'quiz' : 'quizzes'}
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenChannel}>
          Open channel
        </Button>
      </header>

      <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} onSelect={() => onOpenQuiz(quiz.id)} />
        ))}
      </ul>
    </section>
  );
}

const STATUS_LABEL: Record<QuizStatus, string> = {
  draft: 'Draft',
  live: 'Live',
  open: 'Open',
  closed: 'Closed',
};

const STATUS_DOT: Record<QuizStatus, string> = {
  draft: 'bg-ink-subtle',
  live: 'bg-presence-online',
  open: 'bg-blurple',
  closed: 'bg-ink-subtle',
};

interface QuizCardProps {
  quiz: Quiz;
  onSelect: () => void;
}

function QuizCard({ quiz, onSelect }: QuizCardProps): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="bg-glass-surface-1 border-glass-border hover:border-glass-border-strong flex h-full w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-ink text-control min-w-0 flex-1 font-semibold break-words">
            {quiz.title || 'Untitled quiz'}
          </h3>
          <span className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[quiz.status])} />
            <span className="text-ink-subtle text-badge font-semibold tracking-wider uppercase">
              {STATUS_LABEL[quiz.status]}
            </span>
          </span>
        </div>
        <p className="text-ink-muted text-caption">
          {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
          {quiz.mode ? ` · ${quiz.mode}` : ''}
        </p>
      </button>
    </li>
  );
}

// ── Async branches ──────────────────────────────────────────────────────────

function MainSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorMain({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-ink text-body">Couldn&apos;t load your quizzes.</p>
      <Button onClick={onRetry}>
        <Loader2 className="mr-2 size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function EmptyMain(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span
        aria-hidden
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
      >
        <ListChecks className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-ink text-subhead font-semibold">No quizzes yet</h2>
        <p className="text-ink-muted text-caption max-w-sm">
          Open a channel workshop at{' '}
          <code className="text-ink-subtle">/app/labs/quiz/&lt;channelId&gt;</code> to author your
          first quiz.
        </p>
      </div>
    </div>
  );
}
