import { useMaybeRoomContext } from '@livekit/components-react';
import { LiveTrigger } from './VoiceMicStatusButtonLiveTrigger';
import { InertTrigger } from './VoiceMicStatusButtonInertTrigger';

/**
 * Replaces the static `AudioWaveform` chrome in `VoiceUserPanelGroup`.
 * Triggers a Discord-style popover containing a live mic test meter and
 * a noise-suppression toggle. The trigger icon itself glows `text-success`
 * while the local user is speaking so closed-state still communicates
 * audio activity.
 */
export function VoiceMicStatusButton(): React.JSX.Element {
  const room = useMaybeRoomContext();
  if (!room) return <InertTrigger />;
  return <LiveTrigger />;
}
