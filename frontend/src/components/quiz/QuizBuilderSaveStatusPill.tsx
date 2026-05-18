import { Cloud, CloudOff, Loader2 } from 'lucide-react';

export function SaveStatusPill({
  status,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
}): React.JSX.Element | null {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="text-ink-muted text-caption flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="text-ink-muted text-caption flex items-center gap-1.5">
        <Cloud className="size-3" aria-hidden />
        Saved
      </span>
    );
  }
  return (
    <span className="text-destructive text-caption flex items-center gap-1.5">
      <CloudOff className="size-3" aria-hidden />
      Save failed
    </span>
  );
}
