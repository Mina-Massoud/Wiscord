import { useEffect, useState } from 'react';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface DeviceState {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  /** True while we don't have permission to read mic labels — pre-grant the
   * browser returns empty strings, which we surface as "Microphone (X)" so
   * the UI doesn't look broken. */
  needsPermission: boolean;
}

const EMPTY: DeviceState = { inputs: [], outputs: [], needsPermission: false };

async function read(): Promise<DeviceState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return EMPTY;
  }
  const list = await navigator.mediaDevices.enumerateDevices();
  const inputs: AudioDevice[] = [];
  const outputs: AudioDevice[] = [];
  let i = 1;
  let o = 1;
  let needsPermission = false;
  for (const device of list) {
    if (device.kind === 'audioinput') {
      if (!device.label) needsPermission = true;
      inputs.push({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${i++}`,
        kind: 'audioinput',
      });
    } else if (device.kind === 'audiooutput') {
      outputs.push({
        deviceId: device.deviceId,
        label: device.label || `Speakers ${o++}`,
        kind: 'audiooutput',
      });
    }
  }
  return { inputs, outputs, needsPermission };
}

/**
 * Subscribes to `navigator.mediaDevices.devicechange` and re-reads the
 * device list on mount + when devices change. Returns empty arrays on SSR
 * or unsupported browsers — call sites should gate `needsPermission` UI on
 * `inputs.length > 0`.
 */
export function useAudioDevices(): DeviceState {
  const [state, setState] = useState<DeviceState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    function refresh(): void {
      void read().then((next) => {
        if (!cancelled) setState(next);
      });
    }
    refresh();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener?.('devicechange', refresh);
      return () => {
        cancelled = true;
        navigator.mediaDevices.removeEventListener?.('devicechange', refresh);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Short-lived `getUserMedia` to coax the browser into surfacing device
 * labels. We tear down the stream immediately — the permission grant
 * persists, the track does not.
 */
export async function primeDevicePermissions(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  } catch {
    // User denied or no device — the UI handles `needsPermission` from the
    // ensuing empty-label readout, so we don't need to bubble this.
  }
}
