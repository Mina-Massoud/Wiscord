import { Skeleton } from '@/components/ui/skeleton';

export function RowsSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex h-[62px] items-center gap-3 px-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
