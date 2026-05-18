import { Skeleton } from '@/components/ui/skeleton';

export function BuilderSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="border-glass-border w-quiz-list shrink-0 border-r p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="mb-2 h-12 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </div>
  );
}
