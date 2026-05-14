import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2, Mic, PhoneOff, Volume2 } from 'lucide-react';
import { LiveKitRoom, RoomAudioRenderer, useConnectionState } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

import { useVoiceToken } from '@/queries/voice';
import { toast } from '@/lib/toast';
import { playVoiceJoinChime, playVoiceLeaveChime } from '@/lib/voice-chime';
import { useCopy } from '@/lib/copy/useCopy';
import { Button } from '@/components/ui/button';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { LabsChannelSidebar } from '@/components/voice/LabsChannelSidebar';
import { VoiceGrid } from '@/components/voice/VoiceGrid';
import { VoiceControlBar } from '@/components/voice/VoiceControlBar';
import { VoiceUserPanelGroup } from '@/components/voice/VoiceUserPanelGroup';

/**
 * Dev-only voice lounge mounted at `/app/labs/voice/:channelId`.
 *
 * Once we have a token we hoist `<LiveKitRoom>` above the whole shell so
 * every panel that needs voice context (sidebar participants, bottom-left
 * connection strip, control bar, main grid) can read it through hooks
 * without prop drilling.
 *
 * The displayed channel name is a 6-char slug derived from the UUID; the
 * full id is shown small and muted in the top bar for debuggability.
 *
 * Join is *explicit* — page loads in a disconnected state and the user
 * clicks "Join lounge" to actually connect. We *cannot* just call
 * `room.disconnect()` from a button while leaving `<LiveKitRoom connect>`
 * true — LiveKitRoom would immediately reconnect. So the boolean
 * `wantConnected` drives the prop directly; buttons flip it (and call
 * `room.disconnect()` for instant feedback), and the `onDisconnected`
 * callback mirrors the flag back to false in case the server drops us.
 *
 * `hasJoined` is a one-shot latch that flips true the first time we hit
 * Connected. It picks the copy on the empty state — "Join" before the
 * first connect, "Rejoin" afterwards.
 *
 * When the channels module ships, this page is deleted and the inner
 * `<LiveKitRoom>` block is mounted inside the real channel page's voice
 * tab — no component rewrites required.
 */
export default function VoiceLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const tokenQuery = useVoiceToken(channelId);
  const slug = useMemo(() => (channelId ? channelId.slice(-6) : ''), [channelId]);
  const [wantConnected, setWantConnected] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
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

  const { token, livekitUrl, roomName } = tokenQuery.data;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={wantConnected}
      audio
      video={false}
      onConnected={() => {
        setHasJoined(true);
        playVoiceJoinChime();
      }}
      onDisconnected={() => {
        setWantConnected(false);
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
        userPanel={<VoiceUserPanelGroup channelSlug={slug} />}
        topBar={
          <header className="border-glass-border h-app-titlebar flex shrink-0 items-center gap-2 border-b px-4">
            <Volume2 className="text-ink-muted size-4 shrink-0" aria-hidden />
            <span className="text-ink text-subhead font-semibold">{slug}</span>
            <span
              className="text-ink-subtle text-caption ml-2 truncate"
              title={`room: ${roomName}`}
            >
              {channelId}
            </span>
          </header>
        }
        main={
          <VoiceMainPane
            wantConnected={wantConnected}
            hasJoined={hasJoined}
            onJoin={() => setWantConnected(true)}
          />
        }
        rightRail={<ActiveNowPanel />}
      />
    </LiveKitRoom>
  );
}

interface VoiceMainPaneProps {
  wantConnected: boolean;
  hasJoined: boolean;
  onJoin: () => void;
}

/**
 * Lives inside `<LiveKitRoom>` so it can read the connection state.
 * Renders the active lounge (grid + control bar) when connected, and a
 * pre-join / post-leave empty state otherwise.
 */
function VoiceMainPane({
  wantConnected,
  hasJoined,
  onJoin,
}: VoiceMainPaneProps): React.JSX.Element {
  const state = useConnectionState();
  const t = useCopy();
  const isIdle = !wantConnected && state === ConnectionState.Disconnected;

  if (isIdle) {
    const title = hasJoined ? t('voice.left.title') : t('voice.title');
    const subtitle = hasJoined ? t('voice.left.subtitle') : t('voice.idle.subtitle');
    const buttonLabel = hasJoined ? t('voice.left.button') : t('voice.idle.button');

    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <span
          className="bg-surface-1 border-border flex size-16 items-center justify-center rounded-full border"
          aria-hidden
        >
          <PhoneOff className="text-ink-muted size-7" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-ink text-subhead font-semibold">{title}</h2>
          <p className="text-ink-muted text-caption">{subtitle}</p>
        </div>
        <Button onClick={onJoin}>
          <Mic className="mr-2 size-4" aria-hidden />
          {buttonLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <VoiceGrid />
      <VoiceControlBar />
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
