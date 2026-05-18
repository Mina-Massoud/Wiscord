import { Headphones, Mic } from 'lucide-react';
import { QuickControlButton } from './VoiceQuickControlsQuickControlButton';

export function InertControls(): React.JSX.Element {
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
