import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

import type { PlayerAdapter } from './playerAdapter';

interface DirectPlayerProps {
  src: string;
  /**
   * Whether the local user is host. Host gets native controls + emits its
   * own play/pause/seek events to the backend; viewers are read-only and
   * controlled by `useWatchSync`.
   */
  isHost: boolean;
  /** Host-only callbacks. */
  onHostPlay?: (timeMs: number) => void;
  onHostPause?: (timeMs: number) => void;
  onHostSeek?: (timeMs: number) => void;
  /**
   * Fired once the <video> can begin playback. Used by the parent to clear
   * skeleton states.
   */
  onReady?: () => void;
}

/**
 * Bare `<video>` engine for direct .mp4/.webm/etc sources. Exposes the
 * `PlayerAdapter` contract via a ref so `useWatchSync` can drive it.
 *
 * Host vs viewer:
 *   - Host: native `controls` + `play`/`pause`/`seeked` listeners push to
 *     the backend, which broadcasts to viewers.
 *   - Viewer: no `controls`; the element is only mutated by the sync hook.
 *     A transparent overlay traps clicks so the viewer can't accidentally
 *     scrub via the browser's native UI (which is hidden anyway).
 *
 * Muted-by-default for the viewer's first-frame load avoids the Safari
 * autoplay rejection — the chrome bar surfaces an "Unmute" button.
 */
export const DirectPlayer = forwardRef<PlayerAdapter, DirectPlayerProps>(function DirectPlayer(
  { src, isHost, onHostPlay, onHostPause, onHostSeek, onReady },
  forwardedRef,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(
    forwardedRef,
    (): PlayerAdapter => ({
      play: () => {
        const v = videoRef.current;
        if (!v) return;
        // play() can reject (autoplay policy). Swallow rejections silently —
        // the chrome bar handles the unmute prompt in this case.
        void v.play().catch(() => undefined);
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seek: (timeMs) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = timeMs / 1000;
      },
      getCurrentTimeMs: () => {
        const v = videoRef.current;
        return v ? Math.round(v.currentTime * 1000) : 0;
      },
      setMuted: (muted) => {
        if (videoRef.current) videoRef.current.muted = muted;
      },
    }),
    [],
  );

  // Host control event piping — listens to the native player UI and
  // forwards through the supplied callbacks.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!isHost) return;

    const emitPlay = () => onHostPlay?.(Math.round(v.currentTime * 1000));
    const emitPause = () => onHostPause?.(Math.round(v.currentTime * 1000));
    const emitSeek = () => onHostSeek?.(Math.round(v.currentTime * 1000));

    v.addEventListener('play', emitPlay);
    v.addEventListener('pause', emitPause);
    v.addEventListener('seeked', emitSeek);
    return () => {
      v.removeEventListener('play', emitPlay);
      v.removeEventListener('pause', emitPause);
      v.removeEventListener('seeked', emitSeek);
    };
  }, [isHost, onHostPlay, onHostPause, onHostSeek]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="bg-surface-3 size-full"
      playsInline
      controls={isHost}
      preload="metadata"
      onCanPlay={onReady}
    />
  );
});
