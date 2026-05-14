import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';

export interface VoiceTokenResponse {
  token: string;
  livekitUrl: string;
  identity: string;
  roomName: string;
}

/**
 * Fetches a LiveKit access token for the authenticated user in `channelId`.
 *
 * Backend mints a 1-hour JWT. We mark the cached value stale at 50 minutes so
 * a reconnect after near-expiry triggers a fresh fetch instead of joining
 * with a token LiveKit is about to reject.
 *
 * Presence (who's in the channel) is a separate query backed by Socket.IO —
 * see `voice-presence.ts`. The token is *only* minted when a user actually
 * joins a call, so we never spin up speculative LiveKit sessions.
 */
export function useVoiceToken(channelId: string | undefined): UseQueryResult<VoiceTokenResponse> {
  return useQuery<VoiceTokenResponse>({
    queryKey: channelId ? qk.voice.byChannel(channelId) : qk.voice.root,
    queryFn: () =>
      api<VoiceTokenResponse>('/voice/token', {
        method: 'POST',
        body: { channelId },
      }),
    enabled: Boolean(channelId),
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
