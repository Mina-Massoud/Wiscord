import { cn } from '@/lib/cn';
import { Check } from 'lucide-react';
import { type ThemePreset } from '@/lib/theme-presets';
import { PresetPreview } from './ThemePresetSectionPresetPreview';

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
export function PresetCard({ preset, active, onSelect }: PresetCardProps): React.JSX.Element {
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
