import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

export function NotesEditorSkeleton(): React.JSX.Element {
  return (
    <div className="bg-glass-canvas relative flex h-full min-h-0 w-full flex-1 flex-col rounded-lg">
      <div className="mx-auto w-full max-w-[720px] space-y-3 px-6 py-10 sm:px-10">
        <Skeleton className="bg-glass-surface-2 h-4 w-3/4" />
        <Skeleton className="bg-glass-surface-2 h-4 w-2/3" />
        <Skeleton className="bg-glass-surface-2 h-4 w-1/2" />
      </div>
      <div className="absolute top-4 right-4">
        <Loader2 className="text-ink-muted size-4 animate-spin" aria-hidden />
      </div>
    </div>
  );
}
