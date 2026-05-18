import { Mic } from 'lucide-react';

import { cn } from '@/lib/cn';
import { primeDevicePermissions, useAudioDevices, type AudioDevice } from '@/lib/audio-devices';
import { useAudioPrefs } from '@/lib/audio-prefs-store';
import { useVoiceUiState } from '@/lib/voice-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { MicLevelMeter } from '@/components/voice/MicLevelMeter';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';

const NONE_VALUE = '__default__';
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

interface DevicePickerProps {
  label: string;
  options: AudioDevice[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  disabledHint: string | null;
}

function DevicePicker({
  label,
  options,
  value,
  onChange,
  disabled,
  disabledHint,
}: DevicePickerProps): React.JSX.Element {
  const empty = options.length === 0;

  return (
    <div>
      <h4 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
        {label}
      </h4>
      <Select
        value={value ?? NONE_VALUE}
        onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
        disabled={disabled || empty}
      >
        <SelectTrigger className="mt-2 w-full">
          <SelectValue placeholder={empty ? 'No devices found' : 'Default device'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Default device</SelectItem>
          {options.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabledHint ? <p className="text-ink-subtle text-caption mt-2">{disabledHint}</p> : null}
    </div>
  );
}

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function VolumeSlider({ label, value, onChange }: VolumeSliderProps): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h4 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
          {label}
        </h4>
        <span className="text-ink-subtle text-caption tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="bg-glass-surface-2 accent-blurple mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full"
      />
    </div>
  );
}

interface SensitivitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

function SensitivitySlider({ value, onChange }: SensitivitySliderProps): React.JSX.Element {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
          Input Sensitivity
        </h4>
        <span className="text-ink-subtle text-caption tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Input sensitivity"
        className="bg-glass-surface-2 accent-blurple mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full"
      />
      <p className="text-ink-subtle text-caption mt-2">
        Lower opens the mic more easily; higher needs you to be louder.
      </p>
    </div>
  );
}

interface ModeOptionProps {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}

function ModeOption({ active, onClick, title, body }: ModeOptionProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors',
        active
          ? 'border-blurple bg-blurple/10'
          : 'border-glass-border bg-glass-surface-2 hover:border-glass-border-strong',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
          active ? 'border-blurple' : 'border-ink-muted',
        )}
      >
        {active ? <span className="bg-blurple size-2 rounded-full" /> : null}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-ink text-control font-semibold">{title}</span>
        <span className="text-ink-muted text-caption mt-0.5">{body}</span>
      </div>
    </button>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps): React.JSX.Element {
  return (
    <div className="border-glass-border flex items-start gap-4 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-control font-semibold">{label}</span>
        <span className="text-ink-muted text-caption mt-0.5">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
