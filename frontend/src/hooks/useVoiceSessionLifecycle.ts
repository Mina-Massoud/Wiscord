import { useEffect } from 'react';

import { useVoiceSessionStore } from '@/lib/voice-session-store';
import { useVoiceToken } from '@/queries/voice';

/**
 * Bridges the voice-session store to the React Query token cache.
 *
 * Whenever the store has a `channelId` but no `token`, this hook fetches
 * the LiveKit token for that channel and writes it back. That single
 * pattern handles both:
 *
 *   1. Initial join — `store.joinChannel(id)` from the voice page button.
 *   2. Channel switch — `store.joinChannel(otherId)` clears the prior
 *      token; LiveKitRoom disconnects, the hook re-fetches for the new
 *      id, LiveKitRoom reconnects with the fresh credentials.
 *
 * `setSession` discards stale results (channel changed during fetch), so
 * rapid switches are race-safe.
 */
export function useVoiceSessionLifecycle(): void {
  const channelId = useVoiceSessionStore((s) => s.channelId);
  const tokenInStore = useVoiceSessionStore((s) => s.token);

  // useVoiceToken is gated by `enabled: Boolean(channelId)` so it
  // doesn't fire when no channel is selected. The TanStack cache is
  // shared with anywhere else that calls useVoiceToken(channelId),
  // so this dedupes naturally with the voice page's own fetch.
  const tokenQuery = useVoiceToken(channelId ?? undefined);

  useEffect(() => {
    if (!channelId) return;
    if (tokenInStore) return;
    if (!tokenQuery.data) return;
    useVoiceSessionStore.getState().setSession({
      channelId,
      token: tokenQuery.data.token,
      livekitUrl: tokenQuery.data.livekitUrl,
    });
  }, [channelId, tokenInStore, tokenQuery.data]);
}
