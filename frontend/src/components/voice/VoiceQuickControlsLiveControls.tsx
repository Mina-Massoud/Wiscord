import { useRemoteParticipants, useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useVoiceUiState } from '@/lib/voice-state';
import { useEffect } from 'react';
import { Headphones, Mic, MicOff, VolumeX } from 'lucide-react';
import { QuickControlButton } from './VoiceQuickControlsQuickControlButton';

export function LiveControls(): React.JSX.Element {
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
