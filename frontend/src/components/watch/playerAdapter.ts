/**
 * Player engine contract. Both DirectPlayer (<video>) and YouTubePlayer
 * (YT iframe) expose this shape via a ref, so useWatchSync can drive any
 * source through one set of method calls.
 *
 * All times are milliseconds for symmetry with the wire format. Implementations
 * convert to native units (HTMLMediaElement uses seconds; YT uses seconds too).
 */
export interface PlayerAdapter {
  play: () => void;
  pause: () => void;
  /** Move the playhead. Implementations should not auto-start playback. */
  seek: (timeMs: number) => void;
  getCurrentTimeMs: () => number;
  /** Mute or set volume — used by the autoplay fallback path. */
  setMuted: (muted: boolean) => void;
}
