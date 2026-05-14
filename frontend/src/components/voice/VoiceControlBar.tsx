import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useTrackToggle, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';

import { cn } from '@/lib/cn';

/**
 * Floating control pill anchored at the bottom of the voice main pane.
 * Two actions only — mic toggle + leave. Anything else (screen share,
 * camera, deafen) is out of scope and stays off the bar so the icons
 * never lie about what they do.
 */
export function VoiceControlBar(): React.JSX.Element {
  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const room = useRoomContext();

  const micEnabled = micToggle.enabled;
  const pending = micToggle.pending;

  return (
    <div className="pointer-events-none flex justify-center px-6 pt-3 pb-6">
      <div className="bg-surface-2 border-border shadow-elevated rounded-pill pointer-events-auto flex items-center gap-2 border px-3 py-2">
        <button
          type="button"
          onClick={() => {
            void micToggle.toggle();
          }}
          aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={!micEnabled}
          aria-busy={pending}
          disabled={pending}
          className={cn(
            'duration-base flex size-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50',
            micEnabled
              ? 'text-ink hover:bg-surface-hover focus-visible:ring-blurple'
              : 'text-destructive bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive',
          )}
        >
          {micEnabled ? (
            <Mic className="size-5" aria-hidden />
          ) : (
            <MicOff className="size-5" aria-hidden />
          )}
        </button>

        <span className="bg-border h-6 w-px" aria-hidden />

        <button
          type="button"
          onClick={() => {
            void room.disconnect();
          }}
          aria-label="Leave voice lounge"
          className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive duration-base flex size-10 items-center justify-center rounded-full text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <PhoneOff className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
