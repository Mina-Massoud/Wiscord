import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6">
      <Skeleton className="h-24 w-24 rounded-md" />
      <div className="w-full space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
