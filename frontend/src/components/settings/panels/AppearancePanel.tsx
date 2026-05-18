import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/cn';
import {
  useAppearance,
  type AppearanceDensity,
  type AppearanceTheme,
} from '@/lib/appearance-store';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { ThemePresetSection } from './ThemePresetSection';

interface ThemeOption {
  value: AppearanceTheme;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  hint?: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun, disabled: true, hint: 'Coming soon' },
  {
    value: 'system',
    label: 'Sync with computer',
    icon: Monitor,
    disabled: true,
    hint: 'Coming soon',
  },
];

interface DensityOption {
  value: AppearanceDensity;
  label: string;
  body: string;
}

const DENSITY_OPTIONS: DensityOption[] = [
  { value: 'compact', label: 'Compact', body: 'Tighter spacing — fit more on screen.' },
  { value: 'default', label: 'Default', body: 'Balanced spacing — the standard look.' },
  { value: 'spacious', label: 'Spacious', body: 'Looser spacing — easier on the eyes.' },
];

/**
 * Appearance — theme + density. Light and Sync-with-computer are rendered
 * but disabled until the light tokens land; we tell the user that directly
 * instead of pretending the toggle works.
 *
 * Density writes to `<html data-density="…">` via `useApplyAppearance`, which
 * the App root mounts. Tailwind density-variant rules can react with
 * `data-[density=compact]:` etc.
 */
export function AppearancePanel(): React.JSX.Element {
  const theme = useAppearance((s) => s.theme);
  const setTheme = useAppearance((s) => s.setTheme);
  const density = useAppearance((s) => s.density);
  const setDensity = useAppearance((s) => s.setDensity);

  return (
    <div>
      <SettingsPanelTitle>Appearance</SettingsPanelTitle>

      <ThemePresetSection />

      <SettingsDivider />

      <SettingsSection
        title="Theme"
        description="Pick how the app looks. Wiscord is dark-first today."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => (
            <ThemeCard
              key={option.value}
              option={option}
              active={theme === option.value}
              onSelect={() => !option.disabled && setTheme(option.value)}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="UI Density"
        description="Tighten or loosen spacing across the channel and message lists."
      >
        <div className="flex flex-col gap-2">
          {DENSITY_OPTIONS.map((option) => (
            <DensityOption
              key={option.value}
              option={option}
              active={density === option.value}
              onSelect={() => setDensity(option.value)}
            />
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

interface ThemeCardProps {
  option: ThemeOption;
  active: boolean;
  onSelect: () => void;
}

function ThemeCard({ option, active, onSelect }: ThemeCardProps): React.JSX.Element {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={option.disabled}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-2 rounded-md border px-4 py-4 text-left transition-colors',
        active && !option.disabled
          ? 'border-blurple bg-blurple/10'
          : 'border-glass-border bg-glass-surface-2',
        option.disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-glass-border-strong',
      )}
    >
      <Icon className="text-ink size-5" />
      <span className="text-ink text-control font-semibold">{option.label}</span>
      {option.hint ? <span className="text-ink-subtle text-caption">{option.hint}</span> : null}
    </button>
  );
}

interface DensityOptionProps {
  option: DensityOption;
  active: boolean;
  onSelect: () => void;
}

function DensityOption({ option, active, onSelect }: DensityOptionProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
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
        <span className="text-ink text-control font-semibold">{option.label}</span>
        <span className="text-ink-muted text-caption mt-0.5">{option.body}</span>
      </div>
    </button>
  );
}
