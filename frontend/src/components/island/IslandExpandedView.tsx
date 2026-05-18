import { useNavigate } from 'react-router';
import { ArrowUpRight, CalendarDays, Play, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { useAuth } from '@/hooks/useAuth';

import { IslandSettingsPopover } from './IslandSettingsPopover';
import { useIslandStore } from './useIslandStore';
import { usePomodoroStore } from './usePomodoroStore';

interface IslandExpandedViewProps {
  /** Wall-clock now-ms — used only for the "Today" header label so it
   *  re-renders alongside the rest of the island when the clock ticks. */
  now: number;
  onClose: () => void;
}

/**
 * Expanded island host content (rendered at 760 × 560 by its Slot).
 * Embeds the same `CalendarShell` the dedicated `/app/calendar` route
 * uses so the user gets the full surface without leaving the page.
 * Header: today label, settings gear, open-fullscreen affordance.
 */
export function IslandExpandedView({ now, onClose }: IslandExpandedViewProps): React.JSX.Element {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const today = new Date(now);

  const pomodoroPhase = usePomodoroStore((s) => s.phase);
  const startPomodoro = usePomodoroStore((s) => s.start);
  const setExpandedTo = useIslandStore((s) => s.setExpandedTo);
  const hasActivePomodoro = pomodoroPhase !== null;

  const onFocusClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (!hasActivePomodoro) startPomodoro();
    setExpandedTo('pomodoro');
  };

  return (
    <div className="flex h-full w-full flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <header className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-ink size-5" aria-hidden />
          <div className="flex flex-col leading-tight">
            <span className="text-ink-muted text-badge tracking-wider uppercase">Today</span>
            <span className="text-ink text-tab font-semibold">{formatToday(today)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="bg-blurple/15 text-blurple hover:bg-blurple/25 hover:text-blurple h-8 gap-1.5 px-3"
            onClick={onFocusClick}
          >
            {hasActivePomodoro ? (
              <Timer className="size-3.5" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            <span className="text-tab">{hasActivePomodoro ? 'Open timer' : 'Start focus'}</span>
          </Button>
          <IslandSettingsPopover />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Open full calendar"
            className="text-ink-muted hover:text-ink size-8"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              navigate('/app/calendar');
            }}
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/20">
        {profile ? (
          <CalendarShell channelId={null} ownerId={profile.id} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-ink-muted text-body">Loading your calendar…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatToday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
