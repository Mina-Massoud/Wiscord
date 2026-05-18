import { Skeleton } from '@/components/ui/skeleton';

export function TileGridSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-3" aria-hidden>
      <Skeleton className="size-14 rounded-md" />
      <Skeleton className="size-14 rounded-md" />
    </div>
  );
}
