import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shape-matching skeleton for the month grid. Stable height so the layout
 * doesn't shift when real data lands.
 */
export function CalendarSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-7 gap-1" aria-label="Loading calendar">
      {Array.from({ length: 42 }).map((_, idx) => (
        <Skeleton key={idx} className="bg-glass-surface-1 h-24 rounded-md" />
      ))}
    </div>
  );
}
