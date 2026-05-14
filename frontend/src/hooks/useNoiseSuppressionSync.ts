import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

import {
  createRnnoisePipeline,
  isProcessedTrack,
  type NoiseSuppressionPipeline,
} from '@/lib/noise-suppressor';
import { useVoiceUiState } from '@/lib/voice-state';

/**
 * Owns the local mic publish path when noise suppression is involved.
 *
 * Reacts to two things:
 *   1. The user toggles their mic on (via `useTrackToggle` in the UI),
 *      which publishes a *raw* track with browser-default constraints.
 *      We detect "this isn't ours" and swap it for an RNNoise-processed
 *      track when suppression is on, or republish raw with no
 *      suppression when it's off.
 *   2. The suppression flag flips while the mic is live. We unpublish
 *      the current track and republish through the matching pipeline.
 *
 * Why swap instead of intercepting the toggle? `useTrackToggle` is the
 * shared shape both VoiceControlBar and VoiceQuickControls use — we'd
 * lose its pending/permission handling if we replaced it. The swap
 * costs a ~200ms audio gap on the *first* unmute and on every flag flip;
 * not noticeable in normal use.
 *
 * Mount this exactly once inside `<LiveKitRoom>`.
 */
export function useNoiseSuppressionSync(): void {
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  const noiseSuppression = useVoiceUiState((s) => s.noiseSuppression);

  const pipelineRef = useRef<NoiseSuppressionPipeline | null>(null);
  // Records which flag value the *currently published* track corresponds to.
  // Cleared whenever we no longer own the pub or when there's no pub.
  const appliedFlagRef = useRef<boolean | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!localParticipant) return;
    if (inFlightRef.current) return;

    const pub = microphoneTrack;
    const currentTrack = pub?.track?.mediaStreamTrack ?? null;

    if (!pub || !currentTrack) {
      // No mic published. Tear down any leftover processor.
      if (pipelineRef.current) {
        pipelineRef.current.destroy();
        pipelineRef.current = null;
      }
      appliedFlagRef.current = null;
      return;
    }

    const haveProcessed = isProcessedTrack(currentTrack);
    const wantProcessed = noiseSuppression;
    const alreadyAligned =
      haveProcessed === wantProcessed && appliedFlagRef.current === noiseSuppression;
    if (alreadyAligned) return;

    inFlightRef.current = true;
    void (async () => {
      try {
        // Grab a fresh raw mic stream. We always open with browser
        // suppression OFF so RNNoise gets the real signal — stacking
        // them muddies the voice. Echo cancellation stays ON because
        // that's a hardware-level concern RNNoise can't replicate.
        const inputStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: false,
            echoCancellation: true,
            autoGainControl: true,
          },
        });
        const [inputTrack] = inputStream.getAudioTracks();
        if (!inputTrack) {
          inFlightRef.current = false;
          return;
        }

        let nextTrack: MediaStreamTrack;
        let nextPipeline: NoiseSuppressionPipeline | null = null;
        if (wantProcessed) {
          nextPipeline = await createRnnoisePipeline(inputTrack);
          nextTrack = nextPipeline.outputTrack;
        } else {
          nextTrack = inputTrack;
        }

        const wasMuted = pub.isMuted;

        // Unpublish the existing track before publishing the new one.
        // `stopOnUnpublish=true` releases the underlying media element.
        // Pass the underlying MediaStreamTrack — `pub.track` is typed
        // as the generic `Track` since `microphoneTrack` is a
        // `TrackPublication`, but `unpublishTrack` accepts the raw
        // MediaStreamTrack overload.
        await localParticipant.unpublishTrack(currentTrack, true);

        const newPub = await localParticipant.publishTrack(nextTrack, {
          source: Track.Source.Microphone,
        });

        if (wasMuted) {
          // Preserve the user's muted intent across the swap.
          await newPub.mute();
        }

        // Tear down the previous pipeline (if any) only AFTER the new
        // one is live, so there's never a moment with no active mic.
        if (pipelineRef.current && pipelineRef.current !== nextPipeline) {
          pipelineRef.current.destroy();
        }
        pipelineRef.current = nextPipeline;
        appliedFlagRef.current = noiseSuppression;
      } catch {
        // Best effort — on failure the user can re-toggle. We don't
        // toast here because the popover switch already reflects intent
        // and a stale track is preferable to no audio.
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [localParticipant, microphoneTrack, noiseSuppression]);

  // Final cleanup if the room unmounts while a pipeline is alive.
  useEffect(() => {
    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.destroy();
        pipelineRef.current = null;
      }
    };
  }, []);
}
