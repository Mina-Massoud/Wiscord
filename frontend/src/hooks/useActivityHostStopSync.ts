import { useEffect, useRef } from 'react';

import { useVoiceSessionStore } from '@/lib/voice-session-store';
import { useVoiceActivity } from '@/queries/voice-activity';
import type { ActivityKind } from '@/queries/client';

const HOST_LED_KINDS: ReadonlySet<ActivityKind> = new Set(['youtube', 'screen-share', 'quiz']);

/**
 * When the host of a host-led activity (watch / screen-share / quiz)
 * ends the session, the server doc disappears via realtime. Everyone
 * else who was *viewing* that activity should fall back to the voice
 * grid instead of staring at a stale embed.
 *
 * Fires only on the *transition* from "had a doc matching my current
 * kind" → "doc for that kind is gone." Crucially, the ref is keyed to
 * the specific kind, not a generic boolean — otherwise switching from
 * quiz → screen-share would trip this hook because the cached quiz
 * doc still exists but doesn't match the new kind, and the hook would
 * yank the user back to the grid even though they just chose to
 * switch activities.
 *
 * Lab kinds (`notes`, `whiteboard`) don't have a server doc so this is
 * inert for them; they leave only when the user clicks X.
 */
export function useActivityHostStopSync(): void {
  const channelId = useVoiceSessionStore((s) => s.channelId);
  const myActivityKind = useVoiceSessionStore((s) => s.myActivityKind);
  const activityQuery = useVoiceActivity(channelId ?? undefined);

  const lastMatchedKindRef = useRef<ActivityKind | null>(null);

  useEffect(() => {
    if (!myActivityKind || !HOST_LED_KINDS.has(myActivityKind)) {
      lastMatchedKindRef.current = null;
      return;
    }
    if (activityQuery.isLoading) return;

    const docMatchesKind =
      activityQuery.data !== null && activityQuery.data?.kind === myActivityKind;

    if (docMatchesKind) {
      lastMatchedKindRef.current = myActivityKind;
      return;
    }

    // The server doc doesn't match my current kind. Only fire the
    // "host stopped" cleanup if we previously had a matching doc for
    // *this* kind. If the match was for a different (now-switched-out)
    // kind, the local change was intentional and we leave it alone.
    if (lastMatchedKindRef.current === myActivityKind) {
      lastMatchedKindRef.current = null;
      useVoiceSessionStore.getState().setActivityKind(null);
    }
  }, [activityQuery.data, activityQuery.isLoading, myActivityKind]);
}
