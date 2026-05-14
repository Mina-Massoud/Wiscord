import { useCallback, useEffect, useRef, useState } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useReducedMotion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useVoiceUiState } from '@/lib/voice-state';

const BAR_COUNT = 24;
// Discord's meter samples roughly the speech band; 6kHz of analyser
// output split across 24 bars gives bins of ~250Hz each, which renders
// pleasingly without spiking on plosives.
const ANALYSER_FFT_SIZE = 1024;
const SMOOTHING = 0.6;

interface MicLevelMeterProps {
  /**
   * If true, the existing LiveKit mic publication is used as the audio
   * source. Otherwise the meter opens a preview `getUserMedia` stream
   * (used when the popover is opened before the user has joined voice).
   */
  preferLivekitTrack?: boolean;
}

/**
 * Discord-style mic test meter. A row of vertical bars whose heights
 * track the local mic's frequency-bucket levels in real time.
 *
 * Honors `prefers-reduced-motion` by replacing the animated bars with a
 * static "Listening…" label while the test is running.
 */
export function MicLevelMeter({
  preferLivekitTrack = true,
}: MicLevelMeterProps): React.JSX.Element {
  const [running, setRunning] = useState(false);
  const reducedMotion = useReducedMotion();
  const room = useMaybeRoomContext();
  const noiseSuppression = useVoiceUiState((s) => s.noiseSuppression);
  const reduced = reducedMotion === true;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      // disconnect throws if the node was already torn down — ignore.
    }
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    if (previewStreamRef.current) {
      for (const t of previewStreamRef.current.getTracks()) t.stop();
      previewStreamRef.current = null;
    }
    // Reset bar heights so an idle meter doesn't show a frozen frame.
    for (const bar of barsRef.current) {
      if (bar) bar.style.transform = 'scaleY(0.06)';
    }
    setRunning(false);
  }, []);

  // Ensure cleanup if the parent (popover) unmounts mid-test.
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (running) {
      stop();
      return;
    }
    let stream: MediaStream | null = null;
    try {
      if (preferLivekitTrack && room) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const lkTrack = pub?.track?.mediaStreamTrack ?? null;
        if (lkTrack) {
          stream = new MediaStream([lkTrack.clone()]);
        }
      }
      if (!stream) {
        // No LiveKit publication (user hasn't unmuted yet). Open our own
        // preview track and honor the persisted noise-suppression flag
        // so the playback matches what callers will hear when the user
        // actually unmutes.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression,
            echoCancellation: true,
            autoGainControl: true,
          },
        });
        previewStreamRef.current = stream;
      }
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;
      // Monitor path: source → analyser → destination. The analyser is a
      // pass-through, so the user hears their own mic through the speakers
      // and can judge quality. Headphones recommended — speakers will feed
      // back into the mic.
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setRunning(true);

      if (reduced) {
        // No animation loop — the visible "Listening…" label is the cue.
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(data);
        const binsPerBar = Math.floor(data.length / BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) sum += data[i * binsPerBar + j];
          const avg = sum / binsPerBar / 255;
          // Floor so silent bars still show a hairline (matches Discord).
          const scale = Math.max(0.06, Math.min(1, avg * 1.6));
          const bar = barsRef.current[i];
          if (bar) bar.style.transform = `scaleY(${scale})`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      stop();
    }
  }, [preferLivekitTrack, room, reduced, running, noiseSuppression, stop]);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant={running ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => {
          void start();
        }}
        aria-pressed={running}
      >
        {running ? 'Stop' : 'Test'}
      </Button>
      {reduced ? (
        <span
          className={cn('text-caption', running ? 'text-success' : 'text-ink-subtle')}
          aria-live="polite"
        >
          {running ? 'Listening…' : 'Idle'}
        </span>
      ) : (
        <div className="flex h-7 flex-1 items-center gap-0.5" aria-hidden role="presentation">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className={cn(
                'block h-full w-1 origin-center rounded-full',
                running ? 'bg-success' : 'bg-ink-subtle/40',
              )}
              style={{ transform: 'scaleY(0.06)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
