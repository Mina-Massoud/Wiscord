import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function PlayerError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-ink text-subhead font-semibold">Couldn&apos;t start the quiz.</p>
      <Button onClick={onRetry}>
        <Loader2 className="mr-2 size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}
