import { beforeEach, describe, expect, test } from 'vitest';

import { useAudioPrefs } from './audio-prefs-store';

const DEFAULTS = {
  inputDeviceId: null,
  outputDeviceId: null,
  inputVolume: 100,
  outputVolume: 100,
  inputMode: 'voiceActivity' as const,
  inputSensitivity: 40,
  echoCancellation: true,
  autoGainControl: true,
};

describe('audio-prefs-store', () => {
  beforeEach(() => {
    useAudioPrefs.setState(DEFAULTS);
  });

  test('defaults match documented values', () => {
    const state = useAudioPrefs.getState();
    expect(state.inputDeviceId).toBeNull();
    expect(state.outputDeviceId).toBeNull();
    expect(state.inputVolume).toBe(100);
    expect(state.outputVolume).toBe(100);
    expect(state.inputMode).toBe('voiceActivity');
    expect(state.inputSensitivity).toBe(40);
    expect(state.echoCancellation).toBe(true);
    expect(state.autoGainControl).toBe(true);
  });

  test('setters update independently and leave the rest alone', () => {
    useAudioPrefs.getState().setInputDeviceId('mic-abc');
    expect(useAudioPrefs.getState().inputDeviceId).toBe('mic-abc');
    expect(useAudioPrefs.getState().outputDeviceId).toBeNull();

    useAudioPrefs.getState().setInputVolume(150);
    expect(useAudioPrefs.getState().inputVolume).toBe(150);
    expect(useAudioPrefs.getState().outputVolume).toBe(100);

    useAudioPrefs.getState().setInputMode('pushToTalk');
    expect(useAudioPrefs.getState().inputMode).toBe('pushToTalk');
    expect(useAudioPrefs.getState().inputSensitivity).toBe(40);

    useAudioPrefs.getState().setEchoCancellation(false);
    expect(useAudioPrefs.getState().echoCancellation).toBe(false);
    expect(useAudioPrefs.getState().autoGainControl).toBe(true);
  });

  test('setInputDeviceId(null) resets to default device', () => {
    useAudioPrefs.getState().setInputDeviceId('mic-abc');
    useAudioPrefs.getState().setInputDeviceId(null);
    expect(useAudioPrefs.getState().inputDeviceId).toBeNull();
  });
});
