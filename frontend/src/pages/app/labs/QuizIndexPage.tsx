import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ListChecks } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/server/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';
import { PaneHeader } from '@/components/ui/pane-header';
import { useMyQuizzes } from '@/queries/quiz';
import type { Quiz } from '@/types/quiz';
import { ChannelSidebar } from './QuizIndexPageChannelSidebar';
import { MainPane } from './QuizIndexPageMainPane';

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
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title="Quiz workshop"
          subtitle={`${groups.length} ${groups.length === 1 ? 'channel' : 'channels'}`}
        />
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

export interface ChannelGroup {
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

// ── Main pane ───────────────────────────────────────────────────────────────

// ── Async branches ──────────────────────────────────────────────────────────
