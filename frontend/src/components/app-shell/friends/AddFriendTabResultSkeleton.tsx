import { Skeleton } from '@/components/ui/skeleton';

export function ResultSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-[58px] items-center gap-3 px-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-28" />
    </div>
  );
}
