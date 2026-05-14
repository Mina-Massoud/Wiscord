import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { loadYouTubeApi, type YouTubePlayerLike } from './youtubeIframeApi';
import type { PlayerAdapter } from './playerAdapter';

interface YouTubePlayerProps {
  videoId: string;
  isHost: boolean;
  onHostPlay?: (timeMs: number) => void;
  onHostPause?: (timeMs: number) => void;
  onHostSeek?: (timeMs: number) => void;
  onReady?: () => void;
}

/**
 * YouTube engine. Mounts a `<div>` slot and asks the YouTube IFrame API to
 * inject the actual iframe into it. The API call is one-shot — once the
 * `videoId` changes we destroy the player and recreate; YouTube doesn't
 * support hot-swapping cleanly.
 *
 * Host vs viewer mirrors `DirectPlayer`: the host's UI events emit control
 * mutations through callbacks, while viewer playback is driven entirely by
 * `useWatchSync` via the ref.
 *
 * State events from YouTube (1 = playing, 2 = paused, 3 = buffering) are
 * the most reliable signal — `getCurrentTime` is polled at seek detection
 * inside the host's UI loop.
 */
export const YouTubePlayer = forwardRef<PlayerAdapter, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, isHost, onHostPlay, onHostPause, onHostSeek, onReady },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerLike | null>(null);
  const lastReportedTimeRef = useRef<number>(0);
  // Latest callbacks live in refs so we don't recreate the player every
  // time the host's handlers change identity.
  const handlersRef = useRef({ onHostPlay, onHostPause, onHostSeek, onReady, isHost });
  handlersRef.current = { onHostPlay, onHostPause, onHostSeek, onReady, isHost };

  useImperativeHandle(
    forwardedRef,
    (): PlayerAdapter => ({
      play: () => {
        playerRef.current?.playVideo();
      },
      pause: () => {
        playerRef.current?.pauseVideo();
      },
      seek: (timeMs) => {
        playerRef.current?.seekTo(timeMs / 1000, true);
      },
      getCurrentTimeMs: () => {
        const p = playerRef.current;
        if (!p) return 0;
        try {
          return Math.round(p.getCurrentTime() * 1000);
        } catch {
          return 0;
        }
      },
      setMuted: (muted) => {
        const p = playerRef.current;
        if (!p) return;
        if (muted) p.mute();
        else p.unMute();
      },
    }),
    [],
  );

  // Boot / rebuild the iframe whenever the videoId changes.
  useEffect(() => {
    let cancelled = false;

    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) return;

      const player: YouTubePlayerLike = new YT.Player(container, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          // Hide the YouTube logo / related videos as much as possible;
          // none of these flags are 100% honored anymore but the picture
          // still reads cleaner than defaults.
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          controls: handlersRef.current.isHost ? 1 : 0,
        },
        events: {
          onReady: () => {
            handlersRef.current.onReady?.();
          },
          onStateChange: (event) => {
            const handlers = handlersRef.current;
            if (!handlers.isHost) return;

            const time = Math.round(event.target.getCurrentTime() * 1000);
            if (event.data === YT.PlayerState.PLAYING) {
              handlers.onHostPlay?.(time);
              lastReportedTimeRef.current = time;
            } else if (event.data === YT.PlayerState.PAUSED) {
              handlers.onHostPause?.(time);
              // Seek detection: when the host scrubs while paused, YouTube
              // fires PAUSED → BUFFERING → PAUSED. We compare the new time
              // against the last reported and emit a seek if the gap is
              // bigger than a normal tick.
              if (Math.abs(time - lastReportedTimeRef.current) > 1200) {
                handlers.onHostSeek?.(time);
              }
              lastReportedTimeRef.current = time;
            }
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  return <div ref={containerRef} className="bg-surface-3 size-full" />;
});
