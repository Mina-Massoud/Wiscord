import { useVoiceSessionLifecycle } from '@/hooks/useVoiceSessionLifecycle';
import { useNoiseSuppressionSync } from '@/hooks/useNoiseSuppressionSync';
import { useActivityHostStopSync } from '@/hooks/useActivityHostStopSync';
import { useSetActivityPresence } from '@/queries/voice-activity';
import { useCopy } from '@/lib/copy/useCopy';
import { useEffect, useRef } from 'react';
import { useVoiceSessionStore } from '@/lib/voice-session-store';
import { toast } from '@/lib/toast';

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

/**
 * Mounts the room-scoped side effects that need to live exactly once
 * inside `<LiveKitRoom>` for the entire app lifetime.
 */
export function GlobalVoiceSideEffects(): null {
  useVoiceSessionLifecycle();
  useNoiseSuppressionSync();
  useActivityHostStopSync();
  useDisconnectionFeedback();
  return null;
}
