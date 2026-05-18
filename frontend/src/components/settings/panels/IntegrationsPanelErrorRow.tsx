import { Button } from '@/components/ui/button';

export function ErrorRow({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-surface-2 flex items-center justify-between gap-4 rounded-md border px-4 py-3">
      <span className="text-destructive text-control">Couldn&apos;t load your connections.</span>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
