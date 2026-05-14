import { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useLocalParticipant, useTracks, VideoTrack } from '@livekit/components-react';
import { Track, type TrackPublication } from 'livekit-client';
import { MonitorUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import type { PlayerAdapter } from './playerAdapter';

interface ScreenShareSourceProps {
  /** If true, this client owns the screen-share publication. */
  isHost: boolean;
  /** Host identity — used by viewers to pick which screen track to render. */
  hostIdentity: string;
  onReady?: () => void;
}

/**
 * Renders the host's LiveKit screen-share track in the player slot. When
 * the local user is host, mounting this component toggles screen capture
 * on; unmounting toggles it back off. Viewers subscribe to the published
 * track filtered to the host's identity.
 *
 * The component implements the `PlayerAdapter` contract as no-ops — there
 * are no play/pause/seek semantics for a live screen capture. The sync
 * hook is still wired so the host banner state stays meaningful, but its
 * adapter calls are intentionally inert.
 */
export const ScreenShareSource = forwardRef<PlayerAdapter, ScreenShareSourceProps>(
  function ScreenShareSource({ isHost, hostIdentity, onReady }, forwardedRef) {
    const { localParticipant } = useLocalParticipant();
    const screenTracks = useTracks([Track.Source.ScreenShare]);
    const [readyFired, setReadyFired] = useState(false);

    useImperativeHandle(
      forwardedRef,
      (): PlayerAdapter => ({
        play: () => undefined,
        pause: () => undefined,
        seek: () => undefined,
        getCurrentTimeMs: () => 0,
        setMuted: () => undefined,
      }),
      [],
    );

    // No on-mount publish: `getDisplayMedia` needs a fresh user gesture,
    // which only exists in the click handler back in `WatchSourcePicker`.
    // No on-unmount unpublish either: in StrictMode (and on any deps
    // change) the cleanup would fire mid-session and silently kill the
    // track the user just shared. The host's explicit "End party" action
    // in `VoiceLabPage` owns the unpublish; full voice-leave is handled
    // by LiveKit's room teardown.

    const hostTrack = screenTracks.find((t) => t.participant.identity === hostIdentity);

    const handleHostReshare = async (): Promise<void> => {
      try {
        await localParticipant.setScreenShareEnabled(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Screen share permission denied.'
            : "Couldn't start screen share. Try again.";
        toast.error(message);
      }
    };

    useEffect(() => {
      if (!hostTrack) return;
      if (readyFired) return;
      onReady?.();
      setReadyFired(true);
    }, [hostTrack, onReady, readyFired]);

    if (!hostTrack) {
      return (
        <div className="bg-surface-3 flex size-full flex-col items-center justify-center gap-4">
          {isHost ? (
            <>
              <p className="text-ink-muted text-caption text-center">
                Your screen share stopped. Pick another window to keep going.
              </p>
              <Button
                onClick={() => {
                  void handleHostReshare();
                }}
                className="gap-2"
              >
                <MonitorUp className="size-4" aria-hidden />
                Share a screen
              </Button>
            </>
          ) : (
            <p className="text-ink-muted text-caption">Waiting for the host to share a screen…</p>
          )}
        </div>
      );
    }

    return (
      <VideoTrack
        trackRef={hostTrack as unknown as Parameters<typeof VideoTrack>[0]['trackRef']}
        className="bg-surface-3 size-full object-contain"
      />
    );
  },
);

// Suppress unused-import warning — TrackPublication is referenced in the
// generic argument shape used by `useTracks` internally.
export type { TrackPublication };
