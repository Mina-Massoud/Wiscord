import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ListChecks } from 'lucide-react';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/server/ServerRail';
import { GlobalUserPanel } from '@/components/app-shell/GlobalUserPanel';
import { PaneHeader } from '@/components/ui/pane-header';
import { QuizSidebar } from '@/components/quiz/QuizSidebar';
import type { QuizMode } from '@/types/quiz';
import { QuizMainPane } from './QuizLabPageQuizMainPane';
import { QuizRightRail } from './QuizLabPageQuizRightRail';
import { FullPageMessage } from './QuizLabPageFullPageMessage';

/**
 * Dev-only quiz workshop mounted at `/app/labs/quiz/:channelId`.
 *
 * URL-driven state:
 *   - `:channelId`     — opaque uuid, sources the channel context until the
 *                        channels module ships
 *   - `?quiz=<id>`     — selected quiz; opens the builder (host) or results
 *                        (closed) or async player (open)
 *   - `?play=1`        — explicit player view (also auto for participants)
 *
 * When the channels module ships, this page is deleted and the inner panes
 * are mounted as a Quiz tab in the real channel page — no rewrites needed.
 */
export default function QuizLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const [search, setSearch] = useSearchParams();
  const quizId = search.get('quiz');
  const playFlag = search.get('play') === '1';

  const slug = useMemo(() => (channelId ? channelId.slice(-6) : ''), [channelId]);

  if (!channelId) {
    return (
      <FullPageMessage>
        <p className="text-ink-muted text-body">No channel id in URL.</p>
      </FullPageMessage>
    );
  }

  const handleSelectQuiz = (id: string): void => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      next.set('quiz', id);
      next.delete('play');
      return next;
    });
  };

  const handleLaunched = (mode: QuizMode): void => {
    if (mode === 'async') {
      // Host can take their own quiz once it's open. Bounce to the player.
      setSearch((prev) => {
        const next = new URLSearchParams(prev);
        next.set('play', '1');
        return next;
      });
    }
    // Live mode: stays on the builder for now. Live host-control overlay lands in PR2.
  };

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={`Labs · Quiz · ${slug}`} />}
      serverRail={<ServerRail />}
      sidebar={
        <QuizSidebar
          channelId={channelId}
          channelSlug={slug}
          selectedQuizId={quizId}
          onSelect={handleSelectQuiz}
        />
      }
      userPanel={<GlobalUserPanel />}
      topBar={
        <PaneHeader
          variant="topbar"
          icon={<ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden />}
          title="Quiz workshop"
          subtitle={<span title={`channel: ${channelId}`}>{slug}</span>}
        />
      }
      main={<QuizMainPane quizId={quizId} playFlag={playFlag} onLaunched={handleLaunched} />}
      rightRail={<QuizRightRail quizId={quizId} playFlag={playFlag} />}
    />
  );
}
