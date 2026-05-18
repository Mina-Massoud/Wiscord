import { Button } from '@/components/ui/button';

export function ErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-callout flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <p className="text-subhead text-ink">Couldn't load your calendar</p>
      <p className="text-caption text-ink-muted">Network hiccup, probably. Want to try again?</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
