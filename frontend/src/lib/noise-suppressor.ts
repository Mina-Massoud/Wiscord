import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';

/**
 * RNNoise-powered noise suppression pipeline.
 *
 * RNNoise is Mozilla's ML-trained real-time noise suppressor (used by
 * Jitsi, OBS, and friends). It runs as a WebAssembly `AudioWorklet`
 * sitting between `getUserMedia` and the LiveKit publish path:
 *
 *   getUserMedia → MediaStreamAudioSource → RnnoiseWorkletNode →
 *                  MediaStreamAudioDestination → cleaned MediaStreamTrack
 *
 * Echo cancellation stays handled by the browser at capture time;
 * RNNoise strips the residual noise that browser-native suppression
 * leaves behind (keyboard, fan, room hum, traffic).
 */

let cachedWasm: Promise<ArrayBuffer> | undefined;
const workletRegisteredFor = new WeakSet<AudioContext>();
const processedTracks = new WeakSet<MediaStreamTrack>();

function getRnnoiseWasm(): Promise<ArrayBuffer> {
  if (!cachedWasm) {
    cachedWasm = loadRnnoise({
      url: rnnoiseWasmUrl,
      simdUrl: rnnoiseSimdWasmUrl,
    });
  }
  return cachedWasm;
}

export interface NoiseSuppressionPipeline {
  /** Cleaned audio track suitable for publishing to LiveKit. */
  outputTrack: MediaStreamTrack;
  /**
   * Tears down the worklet, disconnects nodes, closes the private
   * AudioContext, and stops the input track. Idempotent.
   */
  destroy: () => void;
}

/**
 * Wraps an input mic track in an RNNoise processing graph.
 *
 * The returned `outputTrack` is tagged via a WeakSet so the publish-sync
 * hook can recognize tracks we created and avoid swapping them again
 * (which would loop forever).
 */
export async function createRnnoisePipeline(
  inputTrack: MediaStreamTrack,
): Promise<NoiseSuppressionPipeline> {
  const wasmBinary = await getRnnoiseWasm();
  // RNNoise was trained at 48kHz — running at any other rate produces
  // garbage. Force the AudioContext to match.
  const ctx = new AudioContext({ sampleRate: 48000 });
  if (!workletRegisteredFor.has(ctx)) {
    await ctx.audioWorklet.addModule(rnnoiseWorkletUrl);
    workletRegisteredFor.add(ctx);
  }
  const source = ctx.createMediaStreamSource(new MediaStream([inputTrack]));
  const rnnoise = new RnnoiseWorkletNode(ctx, {
    maxChannels: 1,
    wasmBinary,
  });
  const destination = ctx.createMediaStreamDestination();
  source.connect(rnnoise).connect(destination);

  const [outputTrack] = destination.stream.getAudioTracks();
  if (!outputTrack) {
    if (ctx.state !== 'closed') void ctx.close();
    inputTrack.stop();
    throw new Error('Failed to create processed audio track');
  }
  processedTracks.add(outputTrack);

  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    try {
      source.disconnect();
    } catch {
      // disconnect throws when the node was already torn down — ignore.
    }
    try {
      rnnoise.disconnect();
      rnnoise.destroy();
    } catch {
      // same as above.
    }
    if (ctx.state !== 'closed') void ctx.close();
    inputTrack.stop();
    outputTrack.stop();
  };

  return { outputTrack, destroy };
}

/**
 * `true` when this track was produced by `createRnnoisePipeline`. The
 * sync hook uses this to distinguish raw tracks published by
 * `useTrackToggle` (which it should swap for a processed one) from
 * its own already-processed tracks (which it should leave alone).
 */
export function isProcessedTrack(track: MediaStreamTrack): boolean {
  return processedTracks.has(track);
}
