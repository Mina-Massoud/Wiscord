import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { Loader2, Mic, PhoneOff } from 'lucide-react';
import { useConnectionState } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

import { useVoiceToken } from '@/queries/voice';
import {
  useSetActivityPresence,
  useStopActivity,
  useVoiceActivity,
} from '@/queries/voice-activity';
import {
  useVoiceChannelParticipants,
  type VoiceChannelParticipant,
} from '@/queries/voice-presence';
import { useMyProfile } from '@/queries/profile';
import { toast } from '@/lib/toast';
import { useCopy } from '@/lib/copy/useCopy';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { displayTitle } from '@/lib/funny-title';
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
import { VoiceGrid } from '@/components/voice/VoiceGrid';
import { VoiceControlBar } from '@/components/voice/VoiceControlBar';
import { VoiceUserPanelGroup } from '@/components/voice/VoiceUserPanelGroup';

import { ActivityRenderer } from '@/components/activity/ActivityRenderer';
import { ActiveActivitiesOverlay } from '@/components/activity/ActiveActivitiesOverlay';
import type { ActivityDefinition } from '@/components/activity/ActivityRegistry';
import type { ActivityKind } from '@/queries/client';

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

interface VoiceMainPaneProps {
  channelId: string;
  isThisChannelConnected: boolean;
  myActivityKind: ActivityKind | null;
  onJoin: () => void;
  onActivityPick: (activity: ActivityDefinition) => void;
  onJoinExisting: (kind: ActivityKind) => void;
  onLeaveActivity: () => void;
}

/**
 * Branches:
 *   1. Not connected to this channel → "Join lounge" CTA.
 *   2. Connected + myActivityKind === null → voice grid + activities overlay.
 *   3. Connected + myActivityKind !== null → ActivityRenderer for that kind.
 */
function VoiceMainPane({
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

function FullPageMessage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="bg-canvas text-ink flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      {children}
    </div>
  );
}

interface VoiceLandingPreviewProps {
  participants: VoiceChannelParticipant[];
}

/**
 * Thumbnail card above the idle / left empty state.
 */
function VoiceLandingPreview({ participants }: VoiceLandingPreviewProps): React.JSX.Element {
  const visible = participants.slice(0, 3);
  const overflow = Math.max(participants.length - visible.length, 0);

  return (
    <div className="border-glass-border bg-glass-surface-1 shadow-elevated relative flex aspect-video w-72 items-center justify-center overflow-hidden rounded-lg border">
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2">
          <img
            src="/logo/sleepy.webp"
            alt=""
            width={64}
            height={61}
            loading="lazy"
            className="size-16 object-contain opacity-80"
            aria-hidden
          />
          <span className="text-ink-subtle text-caption">Crickets in here rn</span>
        </div>
      ) : (
        <div className="flex items-center justify-center -space-x-4">
          {visible.map((p) => (
            <img
              key={p.identity}
              src={getIdenticonDataUrl(p.identity || p.name, 128)}
              alt=""
              width={64}
              height={64}
              className="border-glass-border-strong bg-surface-2 size-16 rounded-full border-2"
              aria-hidden
            />
          ))}
          {overflow > 0 ? (
            <span className="bg-surface-2 text-ink text-control border-glass-border-strong flex size-16 items-center justify-center rounded-full border-2 font-semibold">
              +{overflow}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatPresenceSubtitle(participants: VoiceChannelParticipant[], fallback: string): string {
  if (participants.length === 0) return fallback;
  const [first, ...rest] = participants;
  const firstName = (first.name ?? '').trim() || 'Someone';
  if (rest.length === 0) return `${firstName} is locked in over here`;
  if (rest.length === 1) return `${firstName} and 1 other are locked in over here`;
  return `${firstName} and ${rest.length} others are locked in over here`;
}
