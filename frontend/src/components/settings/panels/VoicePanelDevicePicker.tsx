import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type AudioDevice } from '@/lib/audio-devices';

const NONE_VALUE = '__default__';

interface DevicePickerProps {
  label: string;
  options: AudioDevice[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  disabledHint: string | null;
}

export function DevicePicker({
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
          {options
            .filter((device) => device.deviceId !== '')
            .map((device) => (
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
