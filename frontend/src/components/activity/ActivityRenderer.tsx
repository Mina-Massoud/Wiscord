import { useMemo } from 'react';

import { asWatchActivity, type VoiceActivitySnapshot } from '@/queries/client';
import { useLocalParticipant } from '@livekit/components-react';
import { useStartActivity } from '@/queries/voice-activity';
import { useVoiceChannelParticipants } from '@/queries/voice-presence';
import { useMyProfile } from '@/queries/profile';
import { pickCursorColor } from '@/lib/tldraw-theme';
import { ApiError } from '@/queries/client';
import { toast } from '@/lib/toast';
import type { ActivityKind, WatchSourceKind } from '@/queries/client';

import { NotesActivityEmbed } from './embeds/NotesActivityEmbed';
import { WhiteboardActivityEmbed } from './embeds/WhiteboardActivityEmbed';
import { WatchActivityEmbed } from './embeds/WatchActivityEmbed';
import { QuizActivityEmbed } from './embeds/QuizActivityEmbed';
import { PomodoroActivityEmbed } from './embeds/PomodoroActivityEmbed';

interface ActivityRendererProps {
  channelId: string;
  /**
   * The local user's chosen activity. Source of truth for "what does this
   * user see" — not driven by the server doc anymore.
   */
  myActivityKind: ActivityKind;
  /** Server-side activity doc for the channel (host-led kinds only). */
  activity: VoiceActivitySnapshot | null;
  isStarting: boolean;
  /** Fires when the user clicks the activity header's leave/end button. */
  onLeaveActivity: () => void;
}

/**
 * Central dispatcher. Adding a sixth activity is one new case here plus a
 * registry entry and an embed file — every other surface stays unchanged.
 *
 * Display logic per kind:
 *  - `notes` / `whiteboard` — no server doc, just mount the editor with
 *    the voice channel id. Anyone in the kind shares the same editor.
 *  - `youtube` / `screen-share` — if a server doc exists and matches, show
 *    the watch player (host or viewer). If no doc, the local user is the
 *    host-elect; render the source picker which fires `startActivity` on
 *    submit.
 *  - `quiz` — if a server doc exists, render the quiz embed normally. If
 *    no doc, render a small "starting…" hint while the start mutation
 *    that fired with the pick resolves.
 */
export function ActivityRenderer({
  channelId,
  myActivityKind,
  activity,
  isStarting,
  onLeaveActivity,
}: ActivityRendererProps): React.JSX.Element | null {
  const me = useMyProfile().data;
  const presence = useVoiceChannelParticipants(channelId);
  const { localParticipant } = useLocalParticipant();
  const startMutation = useStartActivity();

  const viewers = useMemo(
    () =>
      (presence.data ?? []).map((p) => ({
        identity: p.identity,
        name: p.name,
        avatarUrl: null,
      })),
    [presence.data],
  );

  // For host-led kinds, use the server doc's host if it exists. For lab
  // kinds (no host model), just use the first participant in the kind as
  // an attribution name — purely cosmetic, never grants special powers.
  const remoteHostName = useMemo(() => {
    if (activity) {
      const p = (presence.data ?? []).find((x) => x.identity === activity.hostUserId);
      return p?.name?.trim() || 'Host';
    }
    const firstInKind = (presence.data ?? []).find((x) => x.activityKind === myActivityKind);
    return firstInKind?.name?.trim() || 'Host';
  }, [activity, presence.data, myActivityKind]);

  const isHost = activity ? me?.id === activity.hostUserId : true;

  // Watch / screen-share host who just clicked and hasn't picked a source
  // yet — the doc is null but my activity kind is set, so the user sees
  // the source picker. Submitting it fires startActivity.
  const handlePickWatchSource = (input: {
    kind: WatchSourceKind;
    url: string;
    title: string | null;
  }): void => {
    const watchKind = myActivityKind === 'screen-share' ? 'screen-share' : 'youtube';
    startMutation.mutate(
      {
        channelId,
        kind: watchKind,
        source: input,
      },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'activity_conflict') {
            toast.info(err.message);
            onLeaveActivity();
          } else {
            toast.error(err.message || "Couldn't start the activity");
          }
          // If screen share was partially set up, tear down the local
          // publication so the user isn't broadcasting silently.
          if (myActivityKind === 'screen-share') {
            void localParticipant.setScreenShareEnabled(false).catch(() => undefined);
          }
        },
      },
    );
  };

  switch (myActivityKind) {
    case 'youtube':
    case 'screen-share': {
      const watchParty = activity ? asWatchActivity(activity) : null;
      return (
        <WatchActivityEmbed
          party={watchParty}
          isHost={isHost}
          hostDisplayName={remoteHostName}
          viewers={viewers}
          lockedKind={myActivityKind}
          isStarting={isStarting || startMutation.isPending}
          onPickSource={handlePickWatchSource}
          onEndActivity={onLeaveActivity}
        />
      );
    }

    case 'notes': {
      if (!me) return null;
      return (
        <NotesActivityEmbed
          channelId={channelId}
          hostDisplayName={remoteHostName}
          isHost={isHost}
          user={{ id: me.id, displayName: me.display_name ?? me.username ?? 'You' }}
          onEndActivity={onLeaveActivity}
        />
      );
    }

    case 'whiteboard': {
      if (!me) return null;
      return (
        <WhiteboardActivityEmbed
          channelId={channelId}
          hostDisplayName={remoteHostName}
          isHost={isHost}
          identity={{
            userId: me.id,
            displayName: me.display_name ?? me.username ?? 'You',
            color: pickCursorColor(me.id),
          }}
          onEndActivity={onLeaveActivity}
        />
      );
    }

    case 'quiz': {
      return (
        <QuizActivityEmbed
          channelId={channelId}
          pinnedQuizId={activity?.quizId ?? null}
          hostDisplayName={remoteHostName}
          isHost={isHost}
          onEndActivity={onLeaveActivity}
        />
      );
    }

    case 'pomodoro': {
      // No server doc yet → the local user is the host-elect. Fire the
      // start mutation here so the activity area lands on a real
      // pomodoro snapshot rather than a "starting…" stub.
      if (!activity || !activity.pomodoro) {
        if (!startMutation.isPending && !startMutation.isSuccess) {
          startMutation.mutate(
            { channelId, kind: 'pomodoro' },
            {
              onError: (err) => {
                if (err instanceof ApiError && err.code === 'activity_conflict') {
                  toast.info(err.message);
                  onLeaveActivity();
                } else {
                  toast.error(err.message || "Couldn't start the focus session");
                  onLeaveActivity();
                }
              },
            },
          );
        }
        // Skeleton — same shape as the real embed so when it lands the
        // swap is a content fade, not a layout pop.
        return <PomodoroBootSkeleton />;
      }
      const requesterName = activity.pomodoro.resetRequest
        ? ((presence.data ?? []).find(
            (p) => p.identity === activity.pomodoro!.resetRequest!.byUserId,
          )?.name ?? null)
        : null;
      const participantCount = (presence.data ?? []).filter(
        (p) => p.activityKind === 'pomodoro',
      ).length;
      return (
        <PomodoroActivityEmbed
          channelId={channelId}
          pomodoro={activity.pomodoro}
          isHost={isHost}
          hostDisplayName={remoteHostName}
          participantCount={Math.max(1, participantCount)}
          resetRequesterName={requesterName}
          onEnd={onLeaveActivity}
        />
      );
    }

    default:
      return null;
  }
}

/**
 * Pomodoro boot skeleton. Holds the same layout footprint as the real
 * embed so the swap is invisible — opacity-only fade-in handles the
 * transition. Phase chip, timer placeholder, controls row, and the
 * gradient bloom all in pulse-y muted form.
 */
function PomodoroBootSkeleton(): React.JSX.Element {
  return (
    <div className="relative flex h-full w-full flex-col gap-4 overflow-hidden p-5">
      {/* Soft idle bloom — matches the real embed's gradient shape. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 45%, rgba(88, 101, 242, 0.10) 0%, rgba(88, 101, 242, 0.04) 30%, rgba(88, 101, 242, 0) 60%)',
        }}
      />
      <div className="relative z-10 flex h-full w-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="bg-blurple/70 size-2 animate-pulse rounded-full" />
          <span className="bg-glass-surface-2 h-3 w-24 animate-pulse rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="bg-glass-surface-2 h-14 w-44 animate-pulse rounded-md" />
            <span className="bg-glass-surface-2 h-3 w-32 animate-pulse rounded" />
          </div>
          <span className="bg-glass-surface-2 h-11 w-32 animate-pulse rounded-full" />
        </div>
        <span className="bg-glass-surface-2 mt-auto h-12 w-full animate-pulse rounded-md" />
      </div>
    </div>
  );
}
