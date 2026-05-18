import { useCallback, useRef, useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import type { WatchActivitySnapshot } from '@/queries/client';
import { useActivityControl } from '@/queries/voice-activity';
import { useWatchSync } from '@/hooks/useWatchSync';
import { detectWatchSource } from '@/lib/watch-source';
import { toast } from '@/lib/toast';

import { DirectPlayer } from './DirectPlayer';
import { YouTubePlayer } from './YouTubePlayer';
import { ScreenShareSource } from './ScreenShareSource';
import { WatchPlayerChrome } from './WatchPlayerChrome';
import { HostBanner } from './HostBanner';
import { ViewerDots, type Viewer } from './ViewerDots';
import type { PlayerAdapter } from './playerAdapter';

interface WatchPlayerProps {
  party: WatchActivitySnapshot;
  isHost: boolean;
  hostDisplayName: string;
  viewers: Viewer[];
  onEndParty: () => void;
}

/**
 * Orchestrator for an active watch session. Picks the engine off
 * `source.kind`, exposes that engine's adapter as a ref to `useWatchSync`,
 * and pipes host control events through to the backend.
 *
 * The whole tree is wrapped in a single full-bleed container so the auto-
 * hiding chrome can listen for pointer activity over the entire surface
 * (not just the iframe).
 */
export function WatchPlayer({
  party,
  isHost,
  hostDisplayName,
  viewers,
  onEndParty,
}: WatchPlayerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlayerAdapter | null>(null);
  const [adapter, setAdapter] = useState<PlayerAdapter | null>(null);
  const control = useActivityControl();
  const [dotsRef] = useAutoAnimate<HTMLDivElement>();

  const setPlayerRef = useCallback((p: PlayerAdapter | null) => {
    playerRef.current = p;
    setAdapter(p);
  }, []);

  useWatchSync({ party, isHost, playerRef });

  const handleHostControl = useCallback(
    (action: 'play' | 'pause' | 'seek', timeMs: number) => {
      if (!isHost) return;
      control.mutate(
        { channelId: party.channelId, action, timeMs },
        {
          onError: (err) => {
            toast.error(err.message || "Couldn't update playback");
          },
        },
      );
    },
    [control, isHost, party.channelId],
  );

  const renderEngine = () => {
    if (party.source.kind === 'youtube') {
      const detected = detectWatchSource(party.source.url);
      const videoId = detected?.providerId ?? '';
      if (videoId === '') {
        return (
          <div className="bg-surface-3 flex size-full items-center justify-center">
            <p className="text-ink-muted text-caption">Invalid YouTube link.</p>
          </div>
        );
      }
      return (
        <YouTubePlayer
          ref={setPlayerRef}
          videoId={videoId}
          isHost={isHost}
          onHostPlay={(t) => handleHostControl('play', t)}
          onHostPause={(t) => handleHostControl('pause', t)}
          onHostSeek={(t) => handleHostControl('seek', t)}
        />
      );
    }
    if (party.source.kind === 'direct') {
      return (
        <DirectPlayer
          ref={setPlayerRef}
          src={party.source.url}
          isHost={isHost}
          onHostPlay={(t) => handleHostControl('play', t)}
          onHostPause={(t) => handleHostControl('pause', t)}
          onHostSeek={(t) => handleHostControl('seek', t)}
        />
      );
    }
    if (party.source.kind === 'screen') {
      return (
        <ScreenShareSource ref={setPlayerRef} isHost={isHost} hostIdentity={party.hostUserId} />
      );
    }
    return (
      <div className="bg-surface-3 flex size-full items-center justify-center">
        <p className="text-ink-muted text-caption">Unsupported source.</p>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HostBanner
        party={party}
        isHost={isHost}
        hostDisplayName={hostDisplayName}
        onEndParty={onEndParty}
      />
      <div className="bg-glass-canvas flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <div
          ref={containerRef}
          className="bg-surface-3 relative max-h-full max-w-6xl overflow-hidden rounded-lg"
          // aspect-ratio + max-h-full + max-w-* (no explicit width/height)
          // lets the browser pick the largest 16:9 box that fits both
          // constraints — the canonical fit-aspect-ratio pattern.
          style={{ aspectRatio: '16 / 9', width: '100%' }}
        >
          {renderEngine()}
          <WatchPlayerChrome player={adapter} containerRef={containerRef} />
        </div>
      </div>
      <div ref={dotsRef} className="shrink-0 px-6 pb-2">
        <ViewerDots viewers={viewers} hostUserId={party.hostUserId} />
      </div>
    </div>
  );
}
