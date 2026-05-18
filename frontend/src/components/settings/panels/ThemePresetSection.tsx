import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useThemePreset } from '@/lib/theme-preset-store';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme-presets';
import { SettingsSection } from '../SettingsShell';

/**
 * Color theme picker. Each card paints itself with the preset's own colors
 * and radii so the swatch *is* the preview — clicking flips the whole app
 * to that look on the next paint via `useApplyThemePreset` mounted in App.
 */
export function ThemePresetSection(): React.JSX.Element {
  const presetId = useThemePreset((s) => s.presetId);
  const setPreset = useThemePreset((s) => s.setPreset);

  return (
    <SettingsSection
      title="Color theme"
      description="Pick a vibe — surface tones, accent color, and corner round all flip at once. Saved on this device."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEME_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            active={preset.id === presetId}
            onSelect={() => setPreset(preset.id)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}

interface PresetCardProps {
  preset: ThemePreset;
  active: boolean;
  onSelect: () => void;
}

/**
 * One card paints itself in the preset's own palette so the user sees the
 * preset's mood without applying it. The selected card also gets a ring in
 * the *current* accent (read from CSS var) so feedback feels live.
 */
function PresetCard({ preset, active, onSelect }: PresetCardProps): React.JSX.Element {
  const { surfaces, accent, radius } = preset;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'group relative flex flex-col gap-3 border p-3 text-left transition-colors',
        'hover:border-glass-border-strong',
        active ? 'border-glass-border-strong' : 'border-glass-border',
      )}
      style={{
        backgroundColor: surfaces.surface1,
        borderRadius: `${radius.md}px`,
        boxShadow: active ? `0 0 0 2px ${accent}` : undefined,
      }}
    >
      <PresetPreview preset={preset} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col leading-tight">
          <span className="text-ink text-control font-semibold">{preset.name}</span>
          <span className="text-ink-muted text-caption mt-0.5">{preset.tagline}</span>
        </div>
        {active ? (
          <span
            className="flex size-5 shrink-0 items-center justify-center text-white"
            style={{ backgroundColor: accent, borderRadius: `${radius.sm}px` }}
            aria-hidden
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </div>
    </button>
  );
}

/**
 * Inline mini-preview of the preset: chrome bar with a "server" dot, a
 * canvas pane with two channel rows and a primary CTA. Uses the preset's
 * own surfaces / accent / radii via inline styles so each card looks
 * different even before the user picks one.
 */
function PresetPreview({ preset }: { preset: ThemePreset }): React.JSX.Element {
  const { surfaces, accent, radius } = preset;
  return (
    <div
      className="flex h-20 overflow-hidden"
      style={{ borderRadius: `${radius.sm}px`, backgroundColor: surfaces.canvas }}
    >
      <div
        className="flex w-7 flex-col items-center gap-1.5 py-2"
        style={{ backgroundColor: surfaces.chrome }}
      >
        <span
          className="size-4"
          style={{ backgroundColor: accent, borderRadius: `${radius.md}px` }}
        />
        <span
          className="size-4"
          style={{ backgroundColor: surfaces.surface2, borderRadius: `${radius.md}px` }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div
          className="h-2 w-3/5"
          style={{ backgroundColor: surfaces.surface2, borderRadius: `${radius.sm}px` }}
        />
        <div
          className="h-2 w-4/5"
          style={{ backgroundColor: surfaces.callout, borderRadius: `${radius.sm}px` }}
        />
        <div className="mt-auto flex items-center gap-1.5">
          <span
            className="h-3 w-10"
            style={{ backgroundColor: accent, borderRadius: `${radius.sm}px` }}
          />
          <span
            className="h-3 w-5"
            style={{ backgroundColor: surfaces.surface2, borderRadius: `${radius.sm}px` }}
          />
        </div>
      </div>
    </div>
  );
}
