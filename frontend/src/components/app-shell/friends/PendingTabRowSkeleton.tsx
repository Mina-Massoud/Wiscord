import { Skeleton } from '@/components/ui/skeleton';

export function RowSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-[62px] items-center gap-3 px-1">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
