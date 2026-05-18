import { type Invoice } from '@/queries/billing';
import { cn } from '@/lib/cn';

export function StatusPill({ status }: { status: Invoice['status'] }): React.JSX.Element {
  const map: Record<Invoice['status'], { label: string; cls: string }> = {
    paid: { label: 'Paid', cls: 'bg-success/15 text-success' },
    open: { label: 'Open', cls: 'bg-blurple/15 text-blurple' },
    draft: { label: 'Draft', cls: 'bg-ink-muted/15 text-ink-muted' },
    uncollectible: { label: 'Failed', cls: 'bg-destructive/15 text-destructive' },
    void: { label: 'Void', cls: 'bg-ink-muted/15 text-ink-muted' },
  };
  const entry = map[status];
  return (
    <span className={cn('text-caption rounded-full px-2 py-0.5 font-semibold', entry.cls)}>
      {entry.label}
    </span>
  );
}
