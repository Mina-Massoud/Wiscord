import { useMaybeRoomContext } from '@livekit/components-react';
import { LiveControls } from './VoiceQuickControlsLiveControls';
import { InertControls } from './VoiceQuickControlsInertControls';

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
