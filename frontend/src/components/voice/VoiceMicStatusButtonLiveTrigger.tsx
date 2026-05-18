import { useIsSpeaking, useLocalParticipant, useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useVoiceUiState } from '@/lib/voice-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { AudioWaveform } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { MicLevelMeter } from './MicLevelMeter';

export function LiveTrigger(): React.JSX.Element {
  const { localParticipant } = useLocalParticipant();
  const speaking = useIsSpeaking(localParticipant);
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const noiseSuppression = useVoiceUiState((s) => s.noiseSuppression);
  const toggleNoiseSuppression = useVoiceUiState((s) => s.toggleNoiseSuppression);

  const muted = !mic.enabled;
  const colorClass = muted
    ? 'text-ink-subtle opacity-60'
    : speaking
      ? 'text-success'
      : 'text-ink-muted';

  return (
    <Popover>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open mic settings"
              className={cn(
                'hover:bg-glass-hover focus-visible:ring-blurple flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none',
                colorClass,
              )}
            >
              <AudioWaveform
                className={cn('size-4 transition-transform', speaking && !muted && 'scale-110')}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Mic settings
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="bg-surface-2 border-border shadow-elevated w-80 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <label
                htmlFor="noise-suppression-switch"
                className="text-ink text-control font-semibold"
              >
                Noise Suppression
              </label>
              <span className="text-ink-muted text-caption">
                RNNoise strips keyboard, fan, and room hum. Off = raw mic.
              </span>
            </div>
            <Switch
              id="noise-suppression-switch"
              checked={noiseSuppression}
              onCheckedChange={toggleNoiseSuppression}
              aria-label="Toggle noise suppression"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-ink text-control font-semibold">Mic Test</span>
            <span className="text-ink-muted text-caption">
              Hit Test, then say hi — you&apos;ll hear yourself through your speakers. Wear
              headphones to avoid feedback.
            </span>
            <MicLevelMeter preferLivekitTrack />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
