import { useEffect } from 'react';
import {
  useMaybeRoomContext,
  useRemoteParticipants,
  useTrackToggle,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Headphones, Mic, MicOff, VolumeX } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useVoiceUiState } from '@/lib/voice-state';

/**
 * Mute + Deafen quick-controls rendered in the bottom-left user panel.
 *
 * Single source of truth:
 *   - Mic state lives on `Room.localParticipant` (LiveKit). Both this
 *     surface and the floating control pill consume it via
 *     `useTrackToggle`, so toggling on one updates the other immediately.
 *   - Deafen is client-only — kept in `useVoiceUiState` (zustand) and
 *     applied to every remote participant's volume here.
 *
 * On routes that don't mount a `<LiveKitRoom>`, the buttons render inert
 * — there's no voice session to act on.
 */
export function VoiceQuickControls(): React.JSX.Element {
  const room = useMaybeRoomContext();
  if (!room) return <InertControls />;
  return <LiveControls />;
}

function LiveControls(): React.JSX.Element {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const remotes = useRemoteParticipants();
  const deafened = useVoiceUiState((s) => s.deafened);
  const toggleDeafened = useVoiceUiState((s) => s.toggleDeafened);

  // Re-applies whenever roster changes so newly joined participants
  // inherit our current deafen state instead of being audible on join.
  useEffect(() => {
    for (const p of remotes) {
      p.setVolume(deafened ? 0 : 1);
    }
  }, [deafened, remotes]);

  // Discord behavior: toggling deafen on also mutes the mic. Undeafening
  // does not auto-unmute — that stays an explicit user choice.
  const handleDeafen = (): void => {
    const next = !deafened;
    toggleDeafened();
    if (next && mic.enabled) {
      void mic.toggle(false);
    }
  };

  return (
    <>
      <QuickControlButton
        label={mic.enabled ? 'Mute' : 'Unmute'}
        active={!mic.enabled}
        pending={mic.pending}
        onClick={() => {
          void mic.toggle();
        }}
      >
        {mic.enabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </QuickControlButton>
      <QuickControlButton
        label={deafened ? 'Undeafen' : 'Deafen'}
        active={deafened}
        onClick={handleDeafen}
      >
        {deafened ? <VolumeX className="size-5" /> : <Headphones className="size-5" />}
      </QuickControlButton>
    </>
  );
}

function InertControls(): React.JSX.Element {
  return (
    <>
      <QuickControlButton label="Mute" disabled>
        <Mic className="size-5" />
      </QuickControlButton>
      <QuickControlButton label="Deafen" disabled>
        <Headphones className="size-5" />
      </QuickControlButton>
    </>
  );
}

interface QuickControlButtonProps {
  label: string;
  active?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

function QuickControlButton({
  label,
  active = false,
  pending = false,
  disabled = false,
  onClick,
  children,
}: QuickControlButtonProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          aria-busy={pending}
          disabled={disabled || pending}
          onClick={onClick}
          className={cn(
            'flex size-8 items-center justify-center rounded-md transition-colors',
            'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            active
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
