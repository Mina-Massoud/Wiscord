import { useEffect, useRef } from 'react';

import { useMusicPlayerStore } from '@/lib/music-player-store';
import { loadYouTubeApi, type YouTubePlayerLike } from '@/components/watch/youtubeIframeApi';

/**
 * Hidden YouTube IFrame audio engine. Mounted once at the App root for
 * the duration of an authed session. The iframe itself is 0×0 and
 * absolutely positioned off-screen — users only hear audio, no video.
 *
 * Why use YouTube as the audio source: it's the only legal way to play
 * full-length music in a browser without per-user Premium gates. Search
 * results from the YT Data API give us the videoId; we hand it here.
 *
 * Sync model is one-directional per concern:
 *   - Store → engine: track / isPlaying / pendingSeekMs
 *   - Engine → store: progressMs, durationMs, isPlaying mirror, ended
 *
 * We don't store a YT player ref in Zustand because YT's player object is
 * non-serializable and recreates on track swaps — keeping it module-local
 * makes the store testable.
 */

const POLL_INTERVAL_MS = 500;
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;
const YT_STATE_ENDED = 0;

export function HiddenMusicPlayer(): null {
  const track = useMusicPlayerStore((s) => s.track);
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const pendingSeekMs = useMusicPlayerStore((s) => s.pendingSeekMs);
  const localMuted = useMusicPlayerStore((s) => s.localMuted);
  const setPlaying = useMusicPlayerStore((s) => s.setPlaying);
  const setProgress = useMusicPlayerStore((s) => s.setProgress);
  const setDuration = useMusicPlayerStore((s) => s.setDuration);
  const clearPendingSeek = useMusicPlayerStore((s) => s.clearPendingSeek);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerLike | null>(null);
  const isReadyRef = useRef(false);
  const lastLoadedIdRef = useRef<string | null>(null);

  // Mount the off-screen container once. The iframe is invisible but kept
  // in the DOM so the browser's autoplay policy honors the user-gesture
  // chain that started playback.
  useEffect(() => {
    const node = document.createElement('div');
    node.setAttribute('aria-hidden', 'true');
    node.style.position = 'fixed';
    node.style.top = '-9999px';
    node.style.left = '-9999px';
    node.style.width = '1px';
    node.style.height = '1px';
    node.style.pointerEvents = 'none';
    document.body.appendChild(node);
    containerRef.current = node;
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      node.remove();
      containerRef.current = null;
      isReadyRef.current = false;
    };
  }, []);

  // Boot / hot-swap the player when the track changes.
  useEffect(() => {
    if (!track) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      // A previous track change can leave us with a player whose iframe
      // is still booting (`isReadyRef.current === false`). Creating a
      // second `YT.Player` on the same container races with the first —
      // the first one's `onReady` flips `isReadyRef` to true while
      // `playerRef.current` already points at the second, half-mounted
      // proxy whose `seekTo` isn't attached yet. Skip the recreate and
      // let the in-flight one finish; on the next track-effect run it
      // will hot-swap cleanly.
      if (playerRef.current) {
        if (isReadyRef.current && lastLoadedIdRef.current !== track.videoId) {
          playerRef.current.loadVideoById(track.videoId);
          lastLoadedIdRef.current = track.videoId;
        }
        return;
      }
      playerRef.current = new YT.Player(container, {
        videoId: track.videoId,
        width: 1,
        height: 1,
        playerVars: { playsinline: 1, controls: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            lastLoadedIdRef.current = track.videoId;
            playerRef.current?.setVolume(85);
            const state = useMusicPlayerStore.getState();
            // Apply mute state up-front so the iframe never blasts even
            // a single frame of audio between onReady and the mute effect.
            if (state.localMuted && typeof playerRef.current?.mute === 'function') {
              playerRef.current.mute();
            }
            // If a seek landed while we were still booting, the
            // pending-seek effect couldn't apply it (player wasn't
            // ready). Consume it here so the viewer doesn't start at 0
            // after the host's bootstrap snapshot.
            if (state.pendingSeekMs !== null && typeof playerRef.current?.seekTo === 'function') {
              playerRef.current.seekTo(state.pendingSeekMs / 1000, true);
              setProgress(state.pendingSeekMs);
              state.clearPendingSeek();
            }
            // Honor the store's intent — `loadTrack(_, { autoplay: false })`
            // (listen-together viewer) needs the iframe to stay paused
            // until the host's first `play` event lands. The previous
            // unconditional `playVideo()` autoplayed even when the store
            // said paused.
            if (state.isPlaying) {
              playerRef.current?.playVideo();
            }
            const d = playerRef.current?.getDuration() ?? 0;
            if (d > 0) setDuration(Math.round(d * 1000));
            // If a track-change landed while we were booting, hot-swap
            // now that we're ready.
            const latest = useMusicPlayerStore.getState().track;
            if (latest && latest.videoId !== lastLoadedIdRef.current) {
              playerRef.current?.loadVideoById(latest.videoId);
              lastLoadedIdRef.current = latest.videoId;
            }
          },
          onStateChange: (event) => {
            if (event.data === YT_STATE_PLAYING) {
              setPlaying(true);
              const d = event.target.getDuration();
              if (d > 0) setDuration(Math.round(d * 1000));
            } else if (event.data === YT_STATE_PAUSED) {
              setPlaying(false);
            } else if (event.data === YT_STATE_ENDED) {
              setPlaying(false);
              setProgress(0);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [track, setPlaying, setProgress, setDuration]);

  // Push isPlaying state down into the iframe.
  useEffect(() => {
    if (!isReadyRef.current) return;
    const player = playerRef.current;
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    if (isPlaying && state !== YT_STATE_PLAYING) {
      player.playVideo();
    } else if (!isPlaying && state === YT_STATE_PLAYING) {
      player.pauseVideo();
    }
  }, [isPlaying]);

  // Push local-mute state down into the iframe. Mute keeps the iframe
  // playing (so a listen-together viewer stays in sync with the host) but
  // silences audio output on this client only.
  useEffect(() => {
    if (!isReadyRef.current) return;
    const player = playerRef.current;
    if (!player || typeof player.mute !== 'function' || typeof player.unMute !== 'function') {
      return;
    }
    if (localMuted) player.mute();
    else player.unMute();
  }, [localMuted]);

  // Honor pending seek requests.
  useEffect(() => {
    if (pendingSeekMs === null) return;
    const player = playerRef.current;
    // Defensive `typeof` guard: a same-container player race (resolved
    // higher up) could in principle leave a proxy without methods. Skip
    // rather than throw if seekTo isn't attached yet — the next host
    // broadcast will re-anchor.
    if (player && isReadyRef.current && typeof player.seekTo === 'function') {
      player.seekTo(pendingSeekMs / 1000, true);
      setProgress(pendingSeekMs);
      clearPendingSeek();
    }
    // If the player isn't ready, leave `pendingSeekMs` set; `onReady`
    // consumes it once the iframe loads, so a seek that arrived during
    // boot (typical for the listen-together viewer) doesn't get dropped.
  }, [pendingSeekMs, clearPendingSeek, setProgress]);

  // Poll progress while playing — YT doesn't push timeupdate.
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !isReadyRef.current) return;
      try {
        const t = player.getCurrentTime();
        if (typeof t === 'number') setProgress(Math.round(t * 1000));
      } catch {
        // YT occasionally throws if the player is mid-buffer; harmless.
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, setProgress]);

  return null;
}
