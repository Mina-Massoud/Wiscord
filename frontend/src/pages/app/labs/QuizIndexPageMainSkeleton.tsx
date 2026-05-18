import { Skeleton } from '@/components/ui/skeleton';

export function MainSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
