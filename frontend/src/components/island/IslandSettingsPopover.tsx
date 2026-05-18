import { CalendarDays, CalendarRange, Settings, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';

import type { IslandIdleWidget } from './useIslandPreferences';
import { useIslandPreferences } from './useIslandPreferences';

/**
 * Settings gear in the expanded island header. Two sections:
 *
 *   1. Idle widget — radio-style picker for what the island rests on
 *      when no auto-priority signal (event, pomodoro, voice) is firing.
 *   2. Auto widgets — toggles per signal source. Disabling one keeps
 *      the underlying state intact but stops it from claiming the pill.
 *
 * Starting a focus session is an *action*, not a preference, so it
 * lives as a primary button in the expanded header — not here.
 */
export function IslandSettingsPopover(): React.JSX.Element {
  const idleWidget = useIslandPreferences((s) => s.preferences.idleWidget);
  const calendar = useIslandPreferences((s) => s.preferences.widgets.calendar);
  const pomodoro = useIslandPreferences((s) => s.preferences.widgets.pomodoro);
  const setIdleWidget = useIslandPreferences((s) => s.setIdleWidget);
  const setWidgetEnabled = useIslandPreferences((s) => s.setWidgetEnabled);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Island settings"
          className="text-ink-muted hover:text-ink size-8"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        data-island-popover
        // Stays at shadcn's default z-50. The island shell is also at
        // z-50 when expanded; this popover mounts after, so DOM order
        // puts it above the shell.
        className="w-72 p-2"
      >
        <p className="text-ink-muted text-badge px-2 pb-1 tracking-wider uppercase">Idle widget</p>
        <IdleWidgetRow
          icon={<CalendarDays className="text-ink-muted size-4" aria-hidden />}
          title="Date"
          description="Today's day, month, event count"
          value="date"
          current={idleWidget}
          onSelect={setIdleWidget}
        />
        <IdleWidgetRow
          icon={<CalendarRange className="text-ink-muted size-4" aria-hidden />}
          title="Next event"
          description="Title + time of next event today"
          value="next-event"
          current={idleWidget}
          onSelect={setIdleWidget}
        />

        <p className="text-ink-muted text-badge mt-2 px-2 pb-1 tracking-wider uppercase">
          Auto override
        </p>
        <SettingRow
          icon={<CalendarDays className="text-ink-muted size-4" aria-hidden />}
          title="Calendar events"
          description="Take over ≤15 min before start"
          checked={calendar}
          onChange={(v) => setWidgetEnabled('calendar', v)}
        />
        <SettingRow
          icon={<Timer className="text-ink-muted size-4" aria-hidden />}
          title="Pomodoro"
          description="Show running timer in the pill"
          checked={pomodoro}
          onChange={(v) => setWidgetEnabled('pomodoro', v)}
        />
      </PopoverContent>
    </Popover>
  );
}

interface IdleWidgetRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: IslandIdleWidget;
  current: IslandIdleWidget;
  onSelect: (value: IslandIdleWidget) => void;
}

function IdleWidgetRow({
  icon,
  title,
  description,
  value,
  current,
  onSelect,
}: IdleWidgetRowProps): React.JSX.Element {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
        active ? 'bg-blurple/15' : 'hover:bg-white/5',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-blurple/20' : 'bg-white/5',
        )}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-tab font-medium">{title}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </div>
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full transition-colors',
          active ? 'bg-blurple' : 'bg-transparent',
        )}
      />
    </button>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: SettingRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-tab font-medium">{title}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Toggle ${title} widget`}
      />
    </div>
  );
}
