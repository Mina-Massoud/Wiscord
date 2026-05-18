import { useEffect, useRef } from 'react';

import { useListenTogetherStore } from '@/lib/listen-together-store';
import { useMusicPlayerStore } from '@/lib/music-player-store';
import { getSocket } from '@/queries/client';
import { useEmitListenTogetherPlayback } from '@/queries/listen-together';
import type { ListenTogetherPlaybackEvent } from '@/types/listen-together';

/**
 * Bridges between `music-player-store` and the listen-together session.
 *
 *  - **Viewer side**: subscribe to `listen_together:playback` socket
 *    events; translate to store writes (`loadTrack`, `setPlaying`,
 *    `seek`). Every event carries `hostProgressMs`, which we apply as a
 *    seek so the viewer never drifts more than one event behind the host.
 *
 *  - **Host side**: on session start, emits an initial snapshot
 *    (`track_changed` + `play`/`pause`) so the viewer can bootstrap from
 *    cold without waiting for the host to touch any control. After that,
 *    watches the player store for play/pause/seek/loadTrack and POSTs to
 *    `/listen-together/sessions/:id/playback`. The mutation hook does
 *    the network; we throttle seeks here so a scrub drag doesn't fire 30
 *    requests.
 *
 * Mount once at App root inside `AuthedMusic` — it's a no-op when there
 * is no active session.
 */

const HOST_SEEK_DEBOUNCE_MS = 300;

export function useListenTogetherSync(): void {
  const session = useListenTogetherStore((s) => s.activeSession);
  const role = useListenTogetherStore((s) => s.role);

  // ── Viewer: receive playback events ────────────────────────────────────
  useEffect(() => {
    if (!session || role !== 'viewer') return;
    const socket = getSocket();

    const onPlayback = (event: ListenTogetherPlaybackEvent): void => {
      if (event.playback.sessionId !== session.id) return;
      const player = useMusicPlayerStore.getState();
      const { playback } = event;

      switch (playback.kind) {
        case 'track_changed':
          if (playback.track) {
            // Viewer waits for host's play event before audio starts —
            // matches the project rule for no auto-blast on the recipient
            // (`feedback_no_auto_mic.md` carries over to listen-together).
            //
            // Skip the loadTrack write when the store is already on this
            // videoId. Repeated identical track_changed events fire on
            // session start (bootstrap + host snapshot) — without this
            // guard, the second write retriggers the iframe engine's
            // track effect mid-mount and the player object ends up half-
            // initialized (methods like seekTo aren't attached yet on the
            // YT proxy, so the next seek call throws).
            if (player.track?.videoId !== playback.track.videoId) {
              player.loadTrack(playback.track, { autoplay: false });
            }
            player.seek(playback.hostProgressMs);
          }
          break;
        case 'play':
          // Anchor to host's progress so cold-boot starts at the right
          // playhead instead of 0.
          player.seek(playback.hostProgressMs);
          if (!player.isPlaying) player.togglePlay();
          break;
        case 'pause':
          // Same anchor on pause — if the host paused mid-track, the
          // viewer's scrubber needs the absolute position.
          player.seek(playback.hostProgressMs);
          if (player.isPlaying) player.togglePlay();
          break;
        case 'seek':
          if (playback.ms !== null) player.seek(playback.ms);
          break;
      }
    };

    socket.on('listen_together:playback', onPlayback);
    return () => {
      socket.off('listen_together:playback', onPlayback);
    };
  }, [session, role]);

  // Drift correction is opportunistic — the host re-broadcasts on every
  // play/pause/seek, which the viewer effect above translates into a
  // pendingSeekMs that re-anchors the iframe. No periodic timer needed
  // for v1; revisit if we add long pure-play stretches without commands.

  useHostBroadcast(session?.id ?? null, role === 'host');
}

/**
 * Hook split out so the host-side subscription has a single, isolated
 * lifecycle. Subscribes to the music player store and forwards changes
 * via the playback mutation. Also fires a one-shot snapshot when the
 * session becomes active so the viewer can bootstrap.
 */
function useHostBroadcast(sessionId: string | null, active: boolean): void {
  const emit = useEmitListenTogetherPlayback();
  // Park `emit` behind a ref. Its identity changes whenever the mutation's
  // internal state ticks (each `mutate` call updates state and returns a
  // new result object), and the first thing this effect does on mount is
  // call `mutate` — listing `emit` directly in the dep array creates a
  // re-mount loop where every emit tears down + re-runs the effect, which
  // re-emits the initial snapshot, which mutates again, which... viewer
  // sees a flood of track_changed+play events and the iframe seeks back to
  // hostProgressMs every cycle — exactly the "stuck, repeats" stutter.
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const lastEmittedRef = useRef<{
    isPlaying: boolean;
    trackId: string | null;
  }>({
    isPlaying: false,
    trackId: null,
  });
  const seekTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !sessionId) return;

    // Snapshot the current state and push it to the viewer. Without this,
    // a host who was already playing when they sent the invite would never
    // emit anything until they touched a control — leaving the viewer's
    // player stuck at 0:00 paused.
    const initial = useMusicPlayerStore.getState();
    lastEmittedRef.current = {
      isPlaying: initial.isPlaying,
      trackId: initial.track?.videoId ?? null,
    };

    if (initial.track) {
      emitRef.current.mutate({
        sessionId,
        payload: {
          kind: 'track_changed',
          track: initial.track,
          hostProgressMs: initial.progressMs,
        },
      });
      emitRef.current.mutate({
        sessionId,
        payload: {
          kind: initial.isPlaying ? 'play' : 'pause',
          hostProgressMs: initial.progressMs,
        },
      });
    }

    const unsubscribe = useMusicPlayerStore.subscribe((state, prev) => {
      // Track change
      if (state.track && state.track.videoId !== prev.track?.videoId) {
        lastEmittedRef.current.trackId = state.track.videoId;
        emitRef.current.mutate({
          sessionId,
          payload: {
            kind: 'track_changed',
            track: state.track,
            hostProgressMs: state.progressMs,
          },
        });
        return;
      }

      // Play/pause toggle
      if (state.isPlaying !== prev.isPlaying) {
        lastEmittedRef.current.isPlaying = state.isPlaying;
        emitRef.current.mutate({
          sessionId,
          payload: {
            kind: state.isPlaying ? 'play' : 'pause',
            hostProgressMs: state.progressMs,
          },
        });
        return;
      }

      // Seek — the engine writes pendingSeekMs and the engine clears it
      // after applying. Watch the request side so we emit once per drag.
      if (state.pendingSeekMs !== null && state.pendingSeekMs !== prev.pendingSeekMs) {
        if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current);
        const seekMs = state.pendingSeekMs;
        seekTimerRef.current = window.setTimeout(() => {
          emitRef.current.mutate({
            sessionId,
            payload: {
              kind: 'seek',
              ms: seekMs,
              hostProgressMs: seekMs,
            },
          });
        }, HOST_SEEK_DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current);
    };
  }, [active, sessionId]);
}
