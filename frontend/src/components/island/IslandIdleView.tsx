import { CalendarDays } from 'lucide-react';

interface IslandIdleViewProps {
  /** Today's day-of-month — anchors the pill so it never reads empty. */
  day: number;
  /** Three-letter month label that rides alongside the day digit. */
  month: string;
  /** Number of events today; renders as a tiny accent dot when > 0. */
  todayCount: number;
}

/**
 * Idle date pill. Apple-DI grammar: icon hard-left, value hard-right.
 * The Slot wrapper in `DynamicIsland` owns sizing and the fade
 * variants — this view is just the content layout.
 */
export function IslandIdleView({ day, month, todayCount }: IslandIdleViewProps): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center">
      <CalendarDays className="text-ink-muted size-3.5 shrink-0" aria-hidden />
      <div className="flex-1" />
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-ink text-tab font-bold tabular-nums">{day}</span>
        <span className="text-ink-muted text-badge font-medium uppercase">{month}</span>
        {todayCount > 0 ? (
          <span
            aria-label={`${todayCount} events today`}
            className="bg-blurple ml-1 size-1.5 shrink-0 rounded-full"
          />
        ) : null}
      </div>
    </div>
  );
}
