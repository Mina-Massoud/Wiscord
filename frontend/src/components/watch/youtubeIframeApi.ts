/**
 * Tiny singleton loader for YouTube's IFrame Player API. We avoid the
 * `react-youtube` dependency — adding a five-year-stable lib for one
 * component is overkill — and instead load YouTube's official script once
 * and resolve a promise when `window.YT.Player` becomes callable.
 *
 * Subsequent callers reuse the same promise. SSR-safe (no work runs on the
 * server side).
 */

interface YouTubePlayerLike {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
}

interface YouTubePlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubePlayerLike }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayerLike }) => void;
  };
}

interface YouTubeApi {
  Player: new (target: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerLike;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      // No-op on the server — the promise stays pending; nothing awaits it
      // before hydration anyway.
      return;
    }
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // Stash a previous callback if one exists (defensive — should be empty).
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
  });

  return apiPromise;
}

export type { YouTubePlayerLike };
