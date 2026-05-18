import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InputMode = 'voiceActivity' | 'pushToTalk';

interface AudioPrefsState {
  /** `navigator.mediaDevices.enumerateDevices()` deviceId, or null to let
   * the browser pick. */
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  /** 0–200; renders as a 0–200% slider matching Discord. */
  inputVolume: number;
  outputVolume: number;
  inputMode: InputMode;
  /** Voice-activity threshold (0–100). 0 = always open, 100 = never opens. */
  inputSensitivity: number;
  echoCancellation: boolean;
  autoGainControl: boolean;

  setInputDeviceId: (id: string | null) => void;
  setOutputDeviceId: (id: string | null) => void;
  setInputVolume: (v: number) => void;
  setOutputVolume: (v: number) => void;
  setInputMode: (mode: InputMode) => void;
  setInputSensitivity: (v: number) => void;
  setEchoCancellation: (enabled: boolean) => void;
  setAutoGainControl: (enabled: boolean) => void;
}

/**
 * Audio preferences persisted across reloads. Noise suppression is owned by
 * the existing `voice-state.ts` store (it's already wired to a
 * republish-the-track hook), so this store stays focused on the rest of the
 * Voice & Video settings surface.
 */
export const useAudioPrefs = create<AudioPrefsState>()(
  persist(
    (set) => ({
      inputDeviceId: null,
      outputDeviceId: null,
      inputVolume: 100,
      outputVolume: 100,
      inputMode: 'voiceActivity',
      inputSensitivity: 40,
      echoCancellation: true,
      autoGainControl: true,

      setInputDeviceId: (inputDeviceId) => set({ inputDeviceId }),
      setOutputDeviceId: (outputDeviceId) => set({ outputDeviceId }),
      setInputVolume: (inputVolume) => set({ inputVolume }),
      setOutputVolume: (outputVolume) => set({ outputVolume }),
      setInputMode: (inputMode) => set({ inputMode }),
      setInputSensitivity: (inputSensitivity) => set({ inputSensitivity }),
      setEchoCancellation: (echoCancellation) => set({ echoCancellation }),
      setAutoGainControl: (autoGainControl) => set({ autoGainControl }),
    }),
    { name: 'wiscord.audio-prefs' },
  ),
);
