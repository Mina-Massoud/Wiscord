import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { Loader2, Mic, PhoneOff } from 'lucide-react';
import { useVoiceToken } from '@/queries/voice';
import {
  useSetActivityPresence,
  useStopActivity,
  useVoiceActivity,
} from '@/queries/voice-activity';
import { useMyProfile } from '@/queries/profile';
import { toast } from '@/lib/toast';
import {
  useConnectedChannelId,
  useMyActivityKind,
  useVoiceSessionStore,
} from '@/lib/voice-session-store';
import { useActivityPick } from '@/hooks/useActivityPick';
import { Button } from '@/components/ui/button';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { LabsChannelSidebar } from '@/components/voice/LabsChannelSidebar';
import { VoiceUserPanelGroup } from '@/components/voice/VoiceUserPanelGroup';
import type { ActivityKind } from '@/queries/client';
import { VoiceMainPane } from './VoiceLabPageVoiceMainPane';
import { FullPageMessage } from './VoiceLabPageFullPageMessage';
const HOST_LED_KINDS: ReadonlySet<ActivityKind> = new Set(['youtube', 'screen-share', 'quiz']);

/**
 * Voice + activity surface mounted at `/app/labs/voice/:channelId`.
 *
 * The page no longer owns the LiveKit `Room`. The room lives at the app
 * root (`GlobalVoiceProvider`) so voice and activity state survive every
 * route change — the page is now a *consumer* of the shared voice
 * session store and only renders the in-channel chrome when this is the
 * channel the user is connected to.
 *
 * Activity-switch logic also lives in a shared hook (`useActivityPick`)
 * so the confirm-before-switch flow is identical here and on every
 * other page that surfaces the chunky activity launcher.
 */
export default function VoiceLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const tokenQuery = useVoiceToken(channelId);
  const slug = useMemo(() => (channelId ? channelId.slice(-6) : ''), [channelId]);

  const connectedChannelId = useConnectedChannelId();
  const isThisChannelConnected = connectedChannelId === channelId;
  const myActivityKind = useMyActivityKind();

  const stopMutation = useStopActivity();
  const presenceMutation = useSetActivityPresence();
  const me = useMyProfile().data;
  const activityQuery = useVoiceActivity(channelId);

  const { pickActivity, joinExistingActivity, confirmDialog } = useActivityPick();

  const activity = activityQuery.data ?? null;
  const isHost = activity ? me?.id === activity.hostUserId : false;

  const handleLeaveActivity = useCallback((): void => {
    if (!channelId) return;
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
    if (!channelId || !tokenQuery.data) return;
    useVoiceSessionStore.getState().joinChannel(channelId);
    useVoiceSessionStore.getState().setSession({
      channelId,
      token: tokenQuery.data.token,
      livekitUrl: tokenQuery.data.livekitUrl,
    });
  }, [channelId, tokenQuery.data]);

  if (!channelId) {
    return (
      <FullPageMessage>
        <p className="text-ink-muted text-body">No channel id in URL.</p>
      </FullPageMessage>
    );
  }

  if (tokenQuery.isLoading) {
    return (
      <FullPageMessage>
        <Loader2 className="text-ink-muted size-6 animate-spin" aria-label="Preparing lounge" />
      </FullPageMessage>
    );
  }

  if (tokenQuery.isError || !tokenQuery.data) {
    return (
      <FullPageMessage>
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
      </FullPageMessage>
    );
  }

  return (
    <>
      <AppShellLayout
        titleBar={<AppTitleBar title={`Voice · ${slug}`} />}
        serverRail={<ServerRail />}
        sidebar={
          <LabsChannelSidebar
            channelId={channelId}
            channelSlug={slug}
            active={isThisChannelConnected}
            onActivate={handleJoin}
          />
        }
        userPanel={<VoiceUserPanelGroup onActivitySelect={pickActivity} />}
        main={
          <VoiceMainPane
            channelId={channelId}
            isThisChannelConnected={isThisChannelConnected}
            myActivityKind={myActivityKind}
            onJoin={handleJoin}
            onActivityPick={pickActivity}
            onJoinExisting={joinExistingActivity}
            onLeaveActivity={handleLeaveActivity}
          />
        }
        rightRail={<ActiveNowPanel />}
      />
      {confirmDialog}
    </>
  );
}
