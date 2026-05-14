import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton matching the populated dashboard layout so the page doesn't shift
 * when real data lands. Shape: header → 3-card stat row → per-question list →
 * leaderboard.
 */
export function QuizAnalyticsSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-1/3" />
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-glass-surface-1 border-glass-border flex flex-col gap-2 rounded-lg border p-4"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-glass-surface-1 border-glass-border flex flex-col gap-3 rounded-lg border p-4"
          >
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
