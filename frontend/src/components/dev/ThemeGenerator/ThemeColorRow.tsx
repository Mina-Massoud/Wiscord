import { useId } from 'react';
import { RotateCcw } from 'lucide-react';

import { cn } from '@/lib/cn';

import {
  hexToHslTriplet,
  hslTripletToHex,
  isValidHex,
  isValidHslTriplet,
  parseRgba,
  rgbaFromHexAndAlpha,
} from './theme-color-util';
import type { ThemeToken } from './theme-tokens';

interface ThemeColorRowProps {
  token: ThemeToken;
  currentValue: string;
  isOverridden: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
}

function pickerHexFromValue(token: ThemeToken, value: string): string {
  if (token.format === 'hex') return isValidHex(value) ? value : '#000000';
  if (token.format === 'rgba') return parseRgba(value)?.hex ?? '#000000';
  return hslTripletToHex(value);
}

function alphaFromValue(token: ThemeToken, value: string): number {
  if (token.format !== 'rgba') return 1;
  return parseRgba(value)?.alpha ?? 1;
}

export function ThemeColorRow({
  token,
  currentValue,
  isOverridden,
  onChange,
  onReset,
}: ThemeColorRowProps): React.JSX.Element {
  const labelId = useId();
  const pickerHex = pickerHexFromValue(token, currentValue);
  const alpha = alphaFromValue(token, currentValue);

  const handlePicker = (rawHex: string): void => {
    if (token.format === 'hex') onChange(rawHex);
    else if (token.format === 'rgba') onChange(rgbaFromHexAndAlpha(rawHex, alpha));
    else onChange(hexToHslTriplet(rawHex));
  };

  const handleAlpha = (rawAlpha: string): void => {
    const next = Number(rawAlpha);
    if (!Number.isFinite(next)) return;
    onChange(rgbaFromHexAndAlpha(pickerHex, Math.max(0, Math.min(1, next))));
  };

  const handleTextInput = (raw: string): void => {
    // Accept the raw string; the emitter will skip it if blank.
    onChange(raw);
  };

  const isValueValid = (() => {
    if (token.format === 'hex') return isValidHex(currentValue);
    if (token.format === 'rgba') return parseRgba(currentValue) !== null;
    return isValidHslTriplet(currentValue);
  })();

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 py-1">
      <label
        htmlFor={labelId}
        className="text-control text-ink-muted truncate font-mono"
        title={token.id}
      >
        {token.label}
      </label>
      <div className="flex items-center gap-1">
        <div
          className="border-glass-border h-5 w-5 shrink-0 rounded-sm border"
          style={{ background: currentValue }}
          aria-hidden="true"
        />
        <input
          type="color"
          aria-label={`${token.label} color picker`}
          value={pickerHex}
          onChange={(event) => handlePicker(event.target.value)}
          className="border-glass-border bg-surface-composer h-6 w-6 cursor-pointer rounded-sm border p-0"
        />
        <button
          type="button"
          onClick={onReset}
          disabled={!isOverridden}
          aria-label={`Reset ${token.label}`}
          className={cn(
            'rounded-sm p-1 transition-colors',
            isOverridden
              ? 'text-ink-muted hover:text-ink hover:bg-glass-hover'
              : 'text-ink-subtle cursor-not-allowed opacity-40',
          )}
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
      <input
        id={labelId}
        type="text"
        value={currentValue}
        onChange={(event) => handleTextInput(event.target.value)}
        spellCheck={false}
        className={cn(
          'text-caption col-span-2 rounded-sm border px-2 py-1 font-mono',
          'bg-surface-composer text-ink border-glass-border',
          'focus:border-blurple focus:ring-blurple/40 focus:ring-2 focus:outline-none',
          !isValueValid && currentValue !== '' && 'border-destructive/60',
        )}
        placeholder={token.defaultValue}
      />
      {token.format === 'rgba' && (
        <div className="col-span-2 flex items-center gap-2">
          <span className="text-badge text-ink-subtle w-10 font-mono uppercase">alpha</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={alpha}
            onChange={(event) => handleAlpha(event.target.value)}
            className="accent-blurple flex-1"
            aria-label={`${token.label} alpha`}
          />
          <span className="text-badge text-ink-muted w-8 text-right font-mono">
            {alpha.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
