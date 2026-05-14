import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2, Mic, PhoneOff } from 'lucide-react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

import { useVoiceToken } from '@/queries/voice';
import { useStartWatchParty, useStopWatchParty, useWatchParty } from '@/queries/watch';
import {
  useVoiceChannelParticipants,
  type VoiceChannelParticipant,
} from '@/queries/voice-presence';
import { useMyProfile } from '@/queries/profile';
import { useNoiseSuppressionSync } from '@/hooks/useNoiseSuppressionSync';
import { toast } from '@/lib/toast';
import { playVoiceJoinChime, playVoiceLeaveChime } from '@/lib/voice-chime';
import { useCopy } from '@/lib/copy/useCopy';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { displayTitle } from '@/lib/funny-title';
import { Button } from '@/components/ui/button';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';

import { LabsChannelSidebar } from '@/components/voice/LabsChannelSidebar';
import { VoiceGrid } from '@/components/voice/VoiceGrid';
import { VoiceControlBar } from '@/components/voice/VoiceControlBar';
import { VoiceUserPanelGroup } from '@/components/voice/VoiceUserPanelGroup';

import { WatchPlayer } from '@/components/watch/WatchPlayer';
import { WatchSourcePicker } from '@/components/watch/WatchSourcePicker';
import type { ActivityDefinition } from '@/components/activity/ActivityRegistry';

/**
 * Dev-only voice + activity surface mounted at `/app/labs/voice/:channelId`.
 *
 * One route, one `<LiveKitRoom>`, one shell. The main pane swaps between
 * voice tiles, an activity source picker, and the active activity player
 * based on the local user's intent and the server-side party state. There
 * is no separate "watch" route — activities live *inside* a voice channel.
 *
 * State machine (within the connected branch):
 *   - No party + `pickerActivity` is null    → <VoiceGrid />
 *   - No party + `pickerActivity` is set     → <WatchSourcePicker /> (this user is choosing a source)
 *   - Active party for this channel          → <WatchPlayer /> (everyone in the channel)
 *
 * `pickerActivity` only exists locally — server-side, the activity is
 * implicit in the party document. So if a viewer arrives after the host
 * has already started, they land straight in the player.
 */
export default function VoiceLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const tokenQuery = useVoiceToken(channelId);
  const slug = useMemo(() => (channelId ? channelId.slice(-6) : ''), [channelId]);
  const [wantConnected, setWantConnected] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [pickerActivity, setPickerActivity] = useState<ActivityDefinition | null>(null);
  const t = useCopy();

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
        <p className="text-ink text-body">Couldn&apos;t reach the voice service.</p>
        <Button
          onClick={() => {
            void tokenQuery.refetch();
          }}
        >
          <Mic className="mr-2 size-4" aria-hidden />
          Try again
        </Button>
      </FullPageMessage>
    );
  }

  const { token, livekitUrl } = tokenQuery.data;

  const handleActivitySelect = (activity: ActivityDefinition) => {
    if (activity.id === 'watch-together') {
      setPickerActivity(activity);
    }
  };

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={wantConnected}
      // Mic must be OFF on join. The user explicitly unmutes via the
      // control pill or the bottom-left panel; we never auto-publish.
      audio={false}
      video={false}
      onConnected={() => {
        setHasJoined(true);
        playVoiceJoinChime();
      }}
      onDisconnected={() => {
        setWantConnected(false);
        setPickerActivity(null);
        if (hasJoined) {
          playVoiceLeaveChime();
          toast.info(t('voice.toast.left'));
        }
      }}
      onError={(err: Error) => {
        toast.error(err.message || "Couldn't connect to voice");
      }}
    >
      <RoomAudioRenderer />
      <VoiceRoomSideEffects />

      <AppShellLayout
        titleBar={<AppTitleBar title={`Voice · ${slug}`} />}
        serverRail={<ServerRail />}
        sidebar={
          <LabsChannelSidebar
            channelId={channelId}
            channelSlug={slug}
            active={wantConnected}
            onActivate={() => setWantConnected(true)}
          />
        }
        userPanel={
          <VoiceUserPanelGroup channelSlug={slug} onActivitySelect={handleActivitySelect} />
        }
        // No topBar, no rightRail: matches Discord's voice view — tiles
        // fill the entire main pane edge to edge. Channel identity lives
        // in the left sidebar header and the "You're Live" card; the
        // raw channel id is debug noise we don't want in chrome.
        main={
          <VoiceMainPane
            channelId={channelId}
            wantConnected={wantConnected}
            hasJoined={hasJoined}
            pickerActivity={pickerActivity}
            onJoin={() => setWantConnected(true)}
            onActivitySelect={handleActivitySelect}
            onCancelPicker={() => setPickerActivity(null)}
          />
        }
      />
    </LiveKitRoom>
  );
}

interface VoiceMainPaneProps {
  channelId: string;
  wantConnected: boolean;
  hasJoined: boolean;
  pickerActivity: ActivityDefinition | null;
  onJoin: () => void;
  onActivitySelect: (activity: ActivityDefinition) => void;
  onCancelPicker: () => void;
}

/**
 * Lives inside `<LiveKitRoom>` so it can read the LiveKit connection state.
 * Three branches:
 *
 *   1. Pre-join idle    → "Join lounge" CTA
 *   2. Connected        → either voice grid, source picker, or active player
 *   3. (Transitions handled by LiveKitRoom's lifecycle — no extra branch)
 */
function VoiceMainPane({
  channelId,
  wantConnected,
  hasJoined,
  pickerActivity,
  onJoin,
  onActivitySelect,
  onCancelPicker,
}: VoiceMainPaneProps): React.JSX.Element {
  const state = useConnectionState();
  const t = useCopy();
  const isIdle = !wantConnected && state === ConnectionState.Disconnected;

  const partyQuery = useWatchParty(channelId);
  const startMutation = useStartWatchParty();
  const stopMutation = useStopWatchParty();
  const presenceQuery = useVoiceChannelParticipants(channelId);
  const myProfile = useMyProfile().data;
  const { localParticipant } = useLocalParticipant();

  if (isIdle) {
    const participants = presenceQuery.data ?? [];
    const channelName = displayTitle(null, channelId);
    // Idle state leads with the channel identity (Discord pattern). Once the
    // user has left, swap to the "you dipped" copy so the surface confirms
    // the action rather than re-pitching the channel.
    const title = hasJoined ? t('voice.left.title') : channelName;
    const subtitle = hasJoined
      ? t('voice.left.subtitle')
      : formatPresenceSubtitle(participants, t('voice.idle.subtitle'));
    const buttonLabel = hasJoined ? t('voice.left.button') : t('voice.idle.button');

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

  const party = partyQuery.data;

  // Active party: every viewer in the channel sees the player.
  if (party) {
    const viewers = (presenceQuery.data ?? []).map((p) => ({
      identity: p.identity,
      name: p.name,
      avatarUrl: null,
    }));
    const host = viewers.find((v) => v.identity === party.hostUserId);
    const hostDisplayName = host?.name ?? 'Host';
    const isHost = myProfile?.id === party.hostUserId;

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <WatchPlayer
          party={party}
          isHost={isHost}
          hostDisplayName={hostDisplayName}
          viewers={viewers}
          onEndParty={() => {
            // Stop the party doc first. When the host ends, also tear
            // down the screen-share publication — `ScreenShareSource`
            // no longer owns that cleanup (its useEffect cleanup would
            // fire in StrictMode and kill the track mid-session).
            stopMutation.mutate(
              { channelId },
              {
                onError: (err) => {
                  toast.error(err.message || "Couldn't end the party");
                },
              },
            );
            if (isHost) {
              void localParticipant.setScreenShareEnabled(false).catch(() => undefined);
            }
          }}
        />
        <VoiceControlBar onActivitySelect={onActivitySelect} />
      </div>
    );
  }

  // No party, local user picked Watch Together → source picker.
  if (pickerActivity?.id === 'watch-together') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-glass-border flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <Button variant="ghost" size="sm" onClick={onCancelPicker}>
            Cancel
          </Button>
          <span className="text-ink-muted text-control ml-2">Start a watch party</span>
        </header>
        <WatchSourcePicker
          onStart={(input) => {
            startMutation.mutate(
              { channelId, source: input },
              {
                onError: (err) => {
                  toast.error(err.message || "Couldn't start the party");
                },
              },
            );
          }}
          isStarting={startMutation.isPending}
        />
        <VoiceControlBar onActivitySelect={onActivitySelect} />
      </div>
    );
  }

  // Default — connected to voice, no activity in flight.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <VoiceGrid />
      <VoiceControlBar onActivitySelect={onActivitySelect} />
    </div>
  );
}

/**
 * Mounted inside `<LiveKitRoom>` so its hooks have room context. Carries
 * room-scoped side effects that don't render UI — currently just the
 * noise-suppression sync that re-publishes the mic when the persisted
 * preference changes.
 */
function VoiceRoomSideEffects(): null {
  useNoiseSuppressionSync();
  return null;
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
 * The thumbnail card above the title on the idle / left empty state. Shows
 * the identicons of who's currently in voice (up to three, with a `+N`
 * chip when the channel is busier than that). Falls back to a phone-off
 * silhouette when the channel is empty — matches Discord's pattern of
 * always anchoring the screen with a visual element.
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
          <span className="text-ink-subtle text-caption">It&apos;s quiet in here</span>
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

/**
 * Builds the "{name} is currently in voice" line shown under the title.
 * Falls back to the registered copy when no one is in the channel — keeps
 * the surface honest instead of pretending presence exists.
 */
function formatPresenceSubtitle(participants: VoiceChannelParticipant[], fallback: string): string {
  if (participants.length === 0) return fallback;
  const [first, ...rest] = participants;
  const firstName = (first.name ?? '').trim() || 'Someone';
  if (rest.length === 0) return `${firstName} is currently in voice`;
  if (rest.length === 1) return `${firstName} and 1 other are currently in voice`;
  return `${firstName} and ${rest.length} others are currently in voice`;
}
