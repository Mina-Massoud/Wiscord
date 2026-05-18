import { useConnectionState } from '@livekit/components-react';
import { useCopy } from '@/lib/copy/useCopy';
import { ConnectionState } from 'livekit-client';
import { useVoiceActivity } from '@/queries/voice-activity';
import {
  useVoiceChannelParticipants,
  type VoiceChannelParticipant,
} from '@/queries/voice-presence';
import { useMyProfile } from '@/queries/profile';
import { displayTitle } from '@/lib/funny-title';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { ActivityRenderer } from '@/components/activity/ActivityRenderer';
import { VoiceGrid } from '@/components/voice/VoiceGrid';
import { ActiveActivitiesOverlay } from '@/components/activity/ActiveActivitiesOverlay';
import { VoiceControlBar } from '@/components/voice/VoiceControlBar';
import type { ActivityKind } from '@/queries/client';
import type { ActivityDefinition } from '@/components/activity/ActivityRegistry';
import { VoiceLandingPreview } from './VoiceLabPageVoiceLandingPreview';

interface VoiceMainPaneProps {
  channelId: string;
  isThisChannelConnected: boolean;
  myActivityKind: ActivityKind | null;
  onJoin: () => void;
  onActivityPick: (activity: ActivityDefinition) => void;
  onJoinExisting: (kind: ActivityKind) => void;
  onLeaveActivity: () => void;
}

function formatPresenceSubtitle(participants: VoiceChannelParticipant[], fallback: string): string {
  if (participants.length === 0) return fallback;
  const [first, ...rest] = participants;
  const firstName = (first.name ?? '').trim() || 'Someone';
  if (rest.length === 0) return `${firstName} is locked in over here`;
  if (rest.length === 1) return `${firstName} and 1 other are locked in over here`;
  return `${firstName} and ${rest.length} others are locked in over here`;
}

/**
 * Branches:
 *   1. Not connected to this channel → "Join lounge" CTA.
 *   2. Connected + myActivityKind === null → voice grid + activities overlay.
 *   3. Connected + myActivityKind !== null → ActivityRenderer for that kind.
 */
export function VoiceMainPane({
  channelId,
  isThisChannelConnected,
  myActivityKind,
  onJoin,
  onActivityPick,
  onJoinExisting,
  onLeaveActivity,
}: VoiceMainPaneProps): React.JSX.Element {
  const state = useConnectionState();
  const t = useCopy();
  const isIdle = !isThisChannelConnected || state === ConnectionState.Disconnected;
  const isLeftThisSession = !isThisChannelConnected && state === ConnectionState.Disconnected;

  const activityQuery = useVoiceActivity(channelId);
  const presenceQuery = useVoiceChannelParticipants(channelId);
  const me = useMyProfile().data;

  if (isIdle) {
    const participants = presenceQuery.data ?? [];
    const channelName = displayTitle(null, channelId);
    const title = isLeftThisSession ? t('voice.left.title') : channelName;
    const subtitle = isLeftThisSession
      ? t('voice.left.subtitle')
      : formatPresenceSubtitle(participants, t('voice.idle.subtitle'));
    const buttonLabel = isLeftThisSession ? t('voice.left.button') : t('voice.idle.button');

    return (
      <div className="bg-voice-landing relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center">
        <VoiceLandingPreview participants={participants} />
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-display text-ink">{title}</h2>
          <p className="text-ink text-control opacity-90">{subtitle}</p>
        </div>
        <Button
          onClick={onJoin}
          size="lg"
          className="rounded-pill text-surface-2 shadow-elevated bg-white px-6 font-semibold transition-colors hover:bg-white/90"
        >
          <Mic className="mr-2 size-4" aria-hidden />
          {buttonLabel}
        </Button>
      </div>
    );
  }

  const showActivity = myActivityKind !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showActivity ? (
        <ActivityRenderer
          channelId={channelId}
          myActivityKind={myActivityKind}
          activity={activityQuery.data ?? null}
          isStarting={false}
          onLeaveActivity={onLeaveActivity}
        />
      ) : (
        <>
          <VoiceGrid>
            <ActiveActivitiesOverlay
              participants={presenceQuery.data ?? []}
              meIdentity={me?.id ?? null}
              onJoin={onJoinExisting}
            />
          </VoiceGrid>
          <VoiceControlBar onActivitySelect={onActivityPick} />
        </>
      )}
    </div>
  );
}
