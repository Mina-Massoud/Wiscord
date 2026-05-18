import { useEffect, useRef } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { useShallow } from 'zustand/react/shallow';

import { useActivityHostStopSync } from '@/hooks/useActivityHostStopSync';
import { useNoiseSuppressionSync } from '@/hooks/useNoiseSuppressionSync';
import { useVoiceSessionLifecycle } from '@/hooks/useVoiceSessionLifecycle';
import { playVoiceJoinChime, playVoiceLeaveChime } from '@/lib/voice-chime';
import { toast } from '@/lib/toast';
import { useCopy } from '@/lib/copy/useCopy';
import { useVoiceSessionStore } from '@/lib/voice-session-store';
import { useSetActivityPresence } from '@/queries/voice-activity';

/**
 * Mounts `<LiveKitRoom>` once at the app root so a joined voice channel
 * survives every route change. The Room never unmounts — the only thing
 * that changes is the `token` / `connect` props, driven by the store.
 *
 * Children render *inside* the LiveKitRoom context, so every consumer of
 * `useRoomContext` / `useTrackToggle` / `useParticipants` resolves
 * regardless of which route is active — even when no channel is joined.
 *
 * Disconnect intent flows two ways:
 *   1. UI "Leave" buttons call `room.disconnect()`. LiveKit fires
 *      `onDisconnected` → `handleDisconnected` clears the store.
 *   2. UI "Join different channel" calls `store.joinChannel(newId)`,
 *      which clears the token. The connect prop flips false, LiveKit
 *      disconnects, but `handleDisconnected` recognises the channel
 *      switch (channelId set, token null) and leaves the store alone.
 *      The lifecycle hook then fetches the new token and connect flips
 *      back to true with the new channel's credentials.
 */
export function GlobalVoiceProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { token, livekitUrl } = useVoiceSessionStore(
    useShallow((s) => ({ token: s.token, livekitUrl: s.livekitUrl })),
  );
  const channelId = useVoiceSessionStore((s) => s.channelId);

  return (
    <LiveKitRoom
      token={token ?? ''}
      serverUrl={livekitUrl ?? ''}
      connect={Boolean(channelId && token && livekitUrl)}
      audio={false}
      video={false}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
    >
      <RoomAudioRenderer />
      <GlobalVoiceSideEffects />
      {children}
    </LiveKitRoom>
  );
}

/**
 * Mounts the room-scoped side effects that need to live exactly once
 * inside `<LiveKitRoom>` for the entire app lifetime.
 */
function GlobalVoiceSideEffects(): null {
  useVoiceSessionLifecycle();
  useNoiseSuppressionSync();
  useActivityHostStopSync();
  useDisconnectionFeedback();
  return null;
}

// ---------------------------------------------------------------------------
// Stable callbacks — fire on the live Room and must not change identity
// every render, otherwise `<LiveKitRoom>` rebinds its event listeners.
// ---------------------------------------------------------------------------

function handleConnected(): void {
  useVoiceSessionStore.getState().markConnected();
  playVoiceJoinChime();
}

function handleDisconnected(): void {
  const { channelId, token, hasConnected } = useVoiceSessionStore.getState();

  // Channel-switch path: a new channelId is set but the new token
  // hasn't arrived yet. The lifecycle hook will populate it and
  // LiveKit will reconnect on its own. Don't clear the store.
  if (channelId !== null && token === null) return;

  useVoiceSessionStore.getState().leaveChannel();
  if (hasConnected) playVoiceLeaveChime();
}

function handleError(err: Error): void {
  toast.error(err.message || "Couldn't connect to voice");
}

/**
 * Translates the store's channelId-cleared transition into a user-facing
 * toast + a "you left the activity" presence write. Subscribes once via
 * Zustand's imperative `subscribe` API so we only react to the disconnect
 * transition itself, never on initial mount.
 */
function useDisconnectionFeedback(): void {
  const presence = useSetActivityPresence();
  const t = useCopy();

  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let prevChannelId = useVoiceSessionStore.getState().channelId;
    const unsubscribe = useVoiceSessionStore.subscribe((state) => {
      const nextChannelId = state.channelId;
      if (Object.is(prevChannelId, nextChannelId)) return;
      const cleared = Boolean(prevChannelId) && nextChannelId === null;
      const fromChannel = prevChannelId;
      prevChannelId = nextChannelId;
      if (!cleared || !fromChannel) return;

      // Fire-and-forget — the webhook reconciles too. Always send
      // null on disconnect; the server treats it as idempotent.
      presenceRef.current.mutate(
        { channelId: fromChannel, kind: null },
        { onError: () => undefined },
      );
      toast.info(tRef.current('voice.toast.left'));
    });
    return unsubscribe;
  }, []);
}
