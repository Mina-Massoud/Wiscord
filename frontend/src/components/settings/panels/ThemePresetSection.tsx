import { useThemePreset } from '@/lib/theme-preset-store';
import { THEME_PRESETS } from '@/lib/theme-presets';
import { SettingsSection } from '../SettingsShell';
import { PresetCard } from './ThemePresetSectionPresetCard';

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
