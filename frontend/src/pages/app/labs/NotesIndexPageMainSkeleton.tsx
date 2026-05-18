import { Skeleton } from '@/components/ui/skeleton';

export function MainSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <section className="px-8 pt-8 pb-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
      </section>
      <section className="flex flex-col gap-4 px-8 pt-2 pb-10">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
