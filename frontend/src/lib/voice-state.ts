import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VoiceUiState {
  /**
   * Discord-style "deafen": all incoming audio silenced. LiveKit has no
   * native concept for this, so we keep it as a client-only flag and the
   * voice quick-controls apply `setVolume(0)` to every remote participant
   * while it's on. Mic state is owned by LiveKit's room — both surfaces
   * (the floating control pill and the left user panel) read it through
   * `useTrackToggle` on the same room context, so no zustand mirror is
   * needed for that.
   *
   * Not persisted — deafen resets per session, matching Discord.
   */
  deafened: boolean;
  toggleDeafened: () => void;
  setDeafened: (deafened: boolean) => void;

  /**
   * Browser-native `noiseSuppression` capture constraint. Persisted so
   * the user's preference survives reload. Applied to the LiveKit mic
   * publication by `useNoiseSuppressionSync` which re-publishes the
   * local audio track whenever the flag flips.
   */
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  setNoiseSuppression: (enabled: boolean) => void;
}

export const useVoiceUiState = create<VoiceUiState>()(
  persist(
    (set) => ({
      deafened: false,
      toggleDeafened: () => set((s) => ({ deafened: !s.deafened })),
      setDeafened: (deafened) => set({ deafened }),

      noiseSuppression: true,
      toggleNoiseSuppression: () => set((s) => ({ noiseSuppression: !s.noiseSuppression })),
      setNoiseSuppression: (noiseSuppression) => set({ noiseSuppression }),
    }),
    {
      name: 'wiscord.voice-ui-state',
      partialize: (state) => ({ noiseSuppression: state.noiseSuppression }),
    },
  ),
);
