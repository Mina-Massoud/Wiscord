import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api, ApiError, getSocket } from '@/queries/client';
import { useListenTogetherStore } from '@/lib/listen-together-store';
import { useMusicPlayerStore } from '@/lib/music-player-store';
import type { MusicTrack } from '@/types/music';
import type {
  ListenTogetherInvite,
  ListenTogetherInviteResolvedEvent,
  ListenTogetherInviteSentEvent,
  ListenTogetherPlaybackEvent,
  ListenTogetherPlaybackKind,
  ListenTogetherSession,
  ListenTogetherSessionEndedEvent,
} from '@/types/listen-together';

/**
 * REST + realtime surface for listen-together. Mirror of `queries/friends.ts`:
 * mutation hooks for the HTTP API, plus a top-level realtime subscriber that
 * pipes every socket event into the listen-together zustand store.
 *
 * The realtime subscriber must be mounted exactly once at App root level —
 * users on any page can receive invites.
 */

interface InviteEnvelope {
  invite: ListenTogetherInvite;
}
interface SessionEnvelope {
  session: ListenTogetherSession;
}

/**
 * Pre-load the session track into the viewer's music player store with
 * autoplay off. Without this, the hidden iframe doesn't have a videoId to
 * boot and the viewer's player stays at 0:00 paused until the host emits
 * a track_changed. `useListenTogetherSync` will seek + play once the host's
 * snapshot lands.
 *
 * No-op if the store is already on that track (covers a reload mid-session
 * where the music store rehydrated from somewhere else).
 */
function bootstrapViewerMusicStore(session: ListenTogetherSession): void {
  const player = useMusicPlayerStore.getState();
  if (player.track?.videoId === session.track.videoId) return;
  player.loadTrack(session.track, { autoplay: false });
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useSendListenTogetherInvite(): UseMutationResult<
  ListenTogetherInvite,
  ApiError,
  { toUserId: string; track: MusicTrack }
> {
  const setSentInvite = useListenTogetherStore((s) => s.setSentInvite);
  return useMutation<ListenTogetherInvite, ApiError, { toUserId: string; track: MusicTrack }>({
    mutationFn: async ({ toUserId, track }) => {
      const result = await api<InviteEnvelope>('/listen-together/invites', {
        method: 'POST',
        body: { toUserId, track },
      });
      return result.invite;
    },
    onSuccess: (invite) => {
      setSentInvite(invite);
    },
  });
}

export function useAcceptListenTogetherInvite(): UseMutationResult<
  ListenTogetherSession,
  ApiError,
  { inviteId: string }
> {
  const enterSession = useListenTogetherStore((s) => s.enterSession);
  return useMutation<ListenTogetherSession, ApiError, { inviteId: string }>({
    mutationFn: async ({ inviteId }) => {
      const result = await api<SessionEnvelope>(`/listen-together/invites/${inviteId}/accept`, {
        method: 'POST',
      });
      return result.session;
    },
    onSuccess: (session) => {
      // The recipient (caller) is always the viewer.
      enterSession(session, 'viewer');
      bootstrapViewerMusicStore(session);
    },
  });
}

export function useDeclineListenTogetherInvite(): UseMutationResult<
  { id: string },
  ApiError,
  { inviteId: string }
> {
  const setIncomingInvite = useListenTogetherStore((s) => s.setIncomingInvite);
  return useMutation<{ id: string }, ApiError, { inviteId: string }>({
    mutationFn: async ({ inviteId }) => {
      return await api<{ id: string }>(`/listen-together/invites/${inviteId}/decline`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setIncomingInvite(null);
    },
  });
}

export function useEndListenTogetherSession(): UseMutationResult<
  { id: string },
  ApiError,
  { sessionId: string }
> {
  const leaveSession = useListenTogetherStore((s) => s.leaveSession);
  return useMutation<{ id: string }, ApiError, { sessionId: string }>({
    mutationFn: async ({ sessionId }) => {
      return await api<{ id: string }>(`/listen-together/sessions/${sessionId}/end`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      leaveSession();
    },
  });
}

export type ListenTogetherPlaybackPayload =
  | { kind: 'play'; hostProgressMs: number }
  | { kind: 'pause'; hostProgressMs: number }
  | { kind: 'seek'; ms: number; hostProgressMs: number }
  | { kind: 'track_changed'; track: MusicTrack; hostProgressMs: number };

export function useEmitListenTogetherPlayback(): UseMutationResult<
  void,
  ApiError,
  { sessionId: string; payload: ListenTogetherPlaybackPayload }
> {
  return useMutation<void, ApiError, { sessionId: string; payload: ListenTogetherPlaybackPayload }>(
    {
      mutationFn: async ({ sessionId, payload }) => {
        await api<{ playback: unknown }>(`/listen-together/sessions/${sessionId}/playback`, {
          method: 'POST',
          body: payload,
        });
      },
    },
  );
}

// ── Realtime ──────────────────────────────────────────────────────────

/**
 * App-root subscriber. Wires every listen-together socket event into the
 * zustand store. Mount in `App.tsx` once — every page can receive invites.
 *
 * Why not a fetch on mount: invites and sessions are ephemeral and never
 * persisted in the cache; they exist purely as live socket state.
 */
export function useListenTogetherRealtime(): void {
  const setIncomingInvite = useListenTogetherStore((s) => s.setIncomingInvite);
  const setSentInvite = useListenTogetherStore((s) => s.setSentInvite);
  const enterSession = useListenTogetherStore((s) => s.enterSession);
  const leaveSession = useListenTogetherStore((s) => s.leaveSession);

  useEffect(() => {
    const socket = getSocket();

    const onInviteReceived = (event: ListenTogetherInviteSentEvent): void => {
      setIncomingInvite(event.invite);
    };

    const onInviteResolved = (event: ListenTogetherInviteResolvedEvent): void => {
      // Two cases the *sender* sees on this channel: accepted (push them
      // into the session as host), declined/expired (clear their sent
      // invite). The *recipient* never receives resolved=declined for
      // their own decline (that's the HTTP response).
      if (event.outcome === 'accepted' && event.session) {
        const state = useListenTogetherStore.getState();
        // Distinguish host vs viewer by checking which invite this resolves.
        if (state.sentInvite?.id === event.inviteId) {
          enterSession(event.session, 'host');
        } else if (state.incomingInvite?.id === event.inviteId) {
          // Accept came through the socket before the HTTP response — sync
          // up. Recipient is viewer.
          enterSession(event.session, 'viewer');
          bootstrapViewerMusicStore(event.session);
        }
      } else if (event.outcome === 'declined' || event.outcome === 'expired') {
        const state = useListenTogetherStore.getState();
        if (state.sentInvite?.id === event.inviteId) setSentInvite(null);
        if (state.incomingInvite?.id === event.inviteId) setIncomingInvite(null);
      }
    };

    const onSessionEnded = (_event: ListenTogetherSessionEndedEvent): void => {
      // The store always projects "the session ended" the same way regardless
      // of role — drop it. The slot rendering "session ended" knows to fade
      // back to whatever non-session view was there before.
      leaveSession();
    };

    const onPlayback = (_event: ListenTogetherPlaybackEvent): void => {
      // Playback events are consumed by `useListenTogetherSync`, which
      // subscribes directly to the socket and writes the music player store.
      // The store doesn't need to mirror them.
    };

    socket.on('listen_together:invite_received', onInviteReceived);
    socket.on('listen_together:invite_resolved', onInviteResolved);
    socket.on('listen_together:session_ended', onSessionEnded);
    socket.on('listen_together:playback', onPlayback);

    return () => {
      socket.off('listen_together:invite_received', onInviteReceived);
      socket.off('listen_together:invite_resolved', onInviteResolved);
      socket.off('listen_together:session_ended', onSessionEnded);
      socket.off('listen_together:playback', onPlayback);
    };
  }, [setIncomingInvite, setSentInvite, enterSession, leaveSession]);
}

export type { ListenTogetherPlaybackKind };
