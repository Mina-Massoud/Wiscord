import { useCallback } from 'react';
import { Loader2, Mic, PhoneOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VoiceMainPane } from '@/pages/app/labs/VoiceLabPageVoiceMainPane';
import { useActivityPick } from '@/hooks/useActivityPick';
import { toast } from '@/lib/toast';
import {
  useConnectedChannelId,
  useMyActivityKind,
  useVoiceSessionStore,
} from '@/lib/voice-session-store';
import type { ChannelDto } from '@/queries/channels';
import type { ActivityKind } from '@/queries/client';
import { useMyProfile } from '@/queries/profile';
import { useVoiceToken } from '@/queries/voice';
import { useSetActivityPresence, useStopActivity, useVoiceActivity } from '@/queries/voice-activity';

const HOST_LED_KINDS: ReadonlySet<ActivityKind> = new Set(['youtube', 'screen-share', 'quiz']);

interface ServerChannelVoicePaneProps {
  channel: ChannelDto;
}

/**
 * Voice lounge inside the server workspace.
 *
 * The LiveKit `Room` lives at the app root (`GlobalVoiceProvider`) and voice
 * state is owned by `voice-session-store`, so this pane is a pure *consumer*:
 * it fetches a token for the channel, drives the join handoff into the store,
 * and renders the shared `VoiceMainPane` (join CTA → grid → tiles → controls).
 * This is the same wiring the labs voice page uses — server voice channels and
 * lab voice channels are the same channel id behind the same `/voice/token`.
 */
export function ServerChannelVoicePane({ channel }: ServerChannelVoicePaneProps): React.JSX.Element {
  const channelId = channel.id;
  const tokenQuery = useVoiceToken(channelId);

  const connectedChannelId = useConnectedChannelId();
  const isThisChannelConnected = connectedChannelId === channelId;
  const myActivityKind = useMyActivityKind();

  const stopMutation = useStopActivity();
  const presenceMutation = useSetActivityPresence();
  const me = useMyProfile().data;
  const activityQuery = useVoiceActivity(channelId);
  const activity = activityQuery.data ?? null;
  const isHost = activity ? me?.id === activity.hostUserId : false;

  const { pickActivity, joinExistingActivity, confirmDialog } = useActivityPick();

  const handleLeaveActivity = useCallback((): void => {
    const wasHostLed = myActivityKind && HOST_LED_KINDS.has(myActivityKind);
    useVoiceSessionStore.getState().setActivityKind(null);
    presenceMutation.mutate({ channelId, kind: null }, { onError: () => undefined });
    if (wasHostLed && isHost) {
      stopMutation.mutate(
        { channelId },
        {
          onError: (err) => toast.error(err.message || "Couldn't end the activity — try again?"),
        },
      );
    }
  }, [channelId, myActivityKind, isHost, presenceMutation, stopMutation]);

  const handleJoin = useCallback((): void => {
    if (!tokenQuery.data) return;
    const home = `/app/servers/${channel.serverId}/channels/${channelId}`;
    useVoiceSessionStore.getState().joinChannel(channelId, home);
    useVoiceSessionStore.getState().setSession({
      channelId,
      token: tokenQuery.data.token,
      livekitUrl: tokenQuery.data.livekitUrl,
    });
  }, [channelId, channel.serverId, tokenQuery.data]);

  if (tokenQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <Loader2 className="text-ink-muted size-6 animate-spin" aria-label="Preparing lounge" />
      </div>
    );
  }

  if (tokenQuery.isError || !tokenQuery.data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <PhoneOff className="text-ink-muted size-8" aria-hidden />
        <p className="text-ink text-body">Voice service ain&apos;t responding rn.</p>
        <Button
          onClick={() => {
            void tokenQuery.refetch();
          }}
        >
          <Mic className="mr-2 size-4" aria-hidden />
          Run it back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <VoiceMainPane
        channelId={channelId}
        isThisChannelConnected={isThisChannelConnected}
        myActivityKind={myActivityKind}
        onJoin={handleJoin}
        onActivityPick={pickActivity}
        onJoinExisting={joinExistingActivity}
        onLeaveActivity={handleLeaveActivity}
      />
      {confirmDialog}
    </div>
  );
}
