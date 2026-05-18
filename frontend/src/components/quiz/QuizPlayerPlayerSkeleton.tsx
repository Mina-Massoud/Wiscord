import { Skeleton } from '@/components/ui/skeleton';

export function PlayerSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-6 px-6 py-10">
      <Skeleton className="h-4 w-40" />
      <div className="border-glass-border bg-glass-surface-1 flex w-full max-w-2xl flex-col gap-4 rounded-lg border p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-3/4" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
