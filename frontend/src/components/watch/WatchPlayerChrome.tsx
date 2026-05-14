import { useEffect, useState } from 'react';
import { Maximize, Volume2, VolumeX } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { PlayerAdapter } from './playerAdapter';

interface WatchPlayerChromeProps {
  player: PlayerAdapter | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The thin control bar that floats over the bottom of the player. Auto-hides
 * after 2.5s of no pointer movement; reappears on hover.
 *
 * Play/pause is delegated to the underlying engine's native controls — the
 * host gets the YouTube/HTML5 chrome, viewers stay read-only.
 */
export function WatchPlayerChrome({
  player,
  containerRef,
}: WatchPlayerChromeProps): React.JSX.Element {
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);

  // Auto-hide on idle.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timeout: number | null = null;

    const reveal = () => {
      setVisible(true);
      if (timeout !== null) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setVisible(false), 2500);
    };

    container.addEventListener('pointermove', reveal);
    container.addEventListener('pointerdown', reveal);
    reveal();
    return () => {
      container.removeEventListener('pointermove', reveal);
      container.removeEventListener('pointerdown', reveal);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [containerRef]);

  const toggleMute = () => {
    if (!player) return;
    const next = !muted;
    player.setMuted(next);
    setMuted(next);
  };

  const goFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  };

  return (
    <div
      className={cn(
        'ease-wiscord duration-base pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pt-12 pb-4 transition-opacity',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="duration-fast pointer-events-auto flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
      >
        {muted ? (
          <VolumeX className="size-4" aria-hidden />
        ) : (
          <Volume2 className="size-4" aria-hidden />
        )}
      </button>

      <div className="ml-auto">
        <button
          type="button"
          onClick={goFullscreen}
          aria-label="Fullscreen"
          className="duration-fast pointer-events-auto flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        >
          <Maximize className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
