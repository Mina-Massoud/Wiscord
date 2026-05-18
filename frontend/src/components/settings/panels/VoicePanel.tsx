import { Mic } from 'lucide-react';
import { primeDevicePermissions, useAudioDevices } from '@/lib/audio-devices';
import { useAudioPrefs } from '@/lib/audio-prefs-store';
import { useVoiceUiState } from '@/lib/voice-state';
import { Button } from '@/components/ui/button';
import { MicLevelMeter } from '@/components/voice/MicLevelMeter';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { DevicePicker } from './VoicePanelDevicePicker';
import { VolumeSlider } from './VoicePanelVolumeSlider';
import { SensitivitySlider } from './VoicePanelSensitivitySlider';
import { ModeOption } from './VoicePanelModeOption';
import { ToggleRow } from './VoicePanelToggleRow';

const HAS_SET_SINK_ID =
  typeof window !== 'undefined' &&
  typeof (HTMLMediaElement?.prototype as { setSinkId?: unknown })?.setSinkId === 'function';

/**
 * Voice & Video — device pickers, volume sliders, input mode, processing
 * toggles. Mirrors Discord's layout: Input/Output side-by-side on the row,
 * sliders below, Mic Test, then the Input Mode radio + Sensitivity slider,
 * then the Voice Processing toggles.
 *
 * Browser caveats handled inline:
 *   - Empty device labels → "Allow microphone access" CTA primes a one-shot
 *     `getUserMedia` to coax the browser into surfacing names.
 *   - `setSinkId` is Chromium-only — the Output Device dropdown is disabled
 *     with an explanatory caption on Safari/Firefox.
 *   - Push-to-Talk is rendered as "Limited" until a real keybind capture
 *     lands in a future slice. We default to Voice Activity.
 */
export function VoicePanel(): React.JSX.Element {
  const { inputs, outputs, needsPermission } = useAudioDevices();
  const prefs = useAudioPrefs();
  const noiseSuppression = useVoiceUiState((s) => s.noiseSuppression);
  const setNoiseSuppression = useVoiceUiState((s) => s.setNoiseSuppression);

  return (
    <div>
      <SettingsPanelTitle>Voice &amp; Video</SettingsPanelTitle>

      <SettingsSection title="Voice">
        {/* Device pickers row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DevicePicker
            label="Input Device"
            options={inputs}
            value={prefs.inputDeviceId}
            onChange={prefs.setInputDeviceId}
            disabled={false}
            disabledHint={null}
          />
          <DevicePicker
            label="Output Device"
            options={outputs}
            value={prefs.outputDeviceId}
            onChange={prefs.setOutputDeviceId}
            disabled={!HAS_SET_SINK_ID}
            disabledHint={
              !HAS_SET_SINK_ID ? "Browser doesn't allow speaker switching from the page." : null
            }
          />
        </div>

        {needsPermission ? (
          <div className="bg-blurple/10 border-blurple/40 mt-4 flex items-center gap-3 rounded-md border px-4 py-3">
            <Mic className="text-blurple size-4 shrink-0" />
            <p className="text-ink text-control flex-1">
              Grant microphone access to see your real devices.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void primeDevicePermissions()}>
              Allow
            </Button>
          </div>
        ) : null}

        {/* Volume row */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <VolumeSlider
            label="Input Volume"
            value={prefs.inputVolume}
            onChange={prefs.setInputVolume}
          />
          <VolumeSlider
            label="Output Volume"
            value={prefs.outputVolume}
            onChange={prefs.setOutputVolume}
          />
        </div>

        {/* Mic test */}
        <div className="mt-8">
          <h4 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
            Mic Test
          </h4>
          <p className="text-ink-subtle text-caption mt-1">
            Having mic issues? Start a test and say something fun — we&apos;ll play your voice back
            to you.
          </p>
          <div className="mt-3">
            <MicLevelMeter preferLivekitTrack={false} />
          </div>
        </div>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title="Input Mode">
        <div className="flex flex-col gap-2">
          <ModeOption
            active={prefs.inputMode === 'voiceActivity'}
            onClick={() => prefs.setInputMode('voiceActivity')}
            title="Voice Activity"
            body="Open the mic when you're speaking. Tune the threshold below."
          />
          <ModeOption
            active={prefs.inputMode === 'pushToTalk'}
            onClick={() => prefs.setInputMode('pushToTalk')}
            title="Push to Talk (Limited)"
            body="Press a key to open the mic. Keybind capture lands in a later slice."
          />
        </div>

        {prefs.inputMode === 'voiceActivity' ? (
          <SensitivitySlider value={prefs.inputSensitivity} onChange={prefs.setInputSensitivity} />
        ) : null}
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Voice Processing"
        description="Browser-side filters applied to your mic stream before LiveKit sees it."
      >
        <div className="flex flex-col gap-1">
          <ToggleRow
            label="Noise Suppression"
            description="Cut keyboard clatter, fans, and other background noise."
            checked={noiseSuppression}
            onCheckedChange={setNoiseSuppression}
          />
          <ToggleRow
            label="Echo Cancellation"
            description="Filter your own voice out of incoming audio when using speakers."
            checked={prefs.echoCancellation}
            onCheckedChange={prefs.setEchoCancellation}
          />
          <ToggleRow
            label="Automatic Gain Control"
            description="Level your mic volume so everyone hears you the same way."
            checked={prefs.autoGainControl}
            onCheckedChange={prefs.setAutoGainControl}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
