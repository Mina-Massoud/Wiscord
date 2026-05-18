import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { findActivity } from '@/components/activity/ActivityRegistry';
import { HostQuizPicker } from './QuizActivityEmbedHostQuizPicker';
import { PinnedQuizView } from './QuizActivityEmbedPinnedQuizView';
import { WaitingForHost } from './QuizActivityEmbedWaitingForHost';

interface QuizActivityEmbedProps {
  channelId: string;
  /** Currently-pinned quiz id, broadcast to everyone in voice. Null = picker. */
  pinnedQuizId: string | null;
  hostDisplayName: string;
  isHost: boolean;
  onEndActivity: () => void;
}

/**
 * Quiz activity embed. The host picks (or builds) a quiz for the channel;
 * the picked quiz id is stored in the activity doc so every voice
 * participant sees the same quiz. Roles:
 *  - Host on a draft  → builder
 *  - Host on a live/open/closed → analytics dashboard
 *  - Participant on any non-draft → player
 *  - Participant on a draft → "host is preparing" empty state
 */
export function QuizActivityEmbed({
  channelId,
  pinnedQuizId,
  hostDisplayName,
  isHost,
  onEndActivity,
}: QuizActivityEmbedProps): React.JSX.Element {
  const definition = findActivity('quiz');
  if (!definition) throw new Error('Quiz activity not in registry');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityHeader
        icon={definition.icon}
        title={definition.title}
        hostDisplayName={hostDisplayName}
        isHost={isHost}
        isHostLed
        onLeaveActivity={onEndActivity}
      />
      <div className="flex min-h-0 flex-1">
        {pinnedQuizId ? (
          <PinnedQuizView
            channelId={channelId}
            quizId={pinnedQuizId}
            isHost={isHost}
            hostDisplayName={hostDisplayName}
          />
        ) : isHost ? (
          <HostQuizPicker channelId={channelId} />
        ) : (
          <WaitingForHost hostDisplayName={hostDisplayName} />
        )}
      </div>
    </div>
  );
}
