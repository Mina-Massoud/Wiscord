import { Receipt } from 'lucide-react';

export function EmptyState(): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-surface-2 flex flex-col items-center gap-3 rounded-md border px-4 py-10 text-center">
      <Receipt className="text-ink-subtle size-8" aria-hidden />
      <div className="flex flex-col leading-tight">
        <span className="text-ink text-control font-semibold">No invoices yet</span>
        <span className="text-ink-muted text-caption mt-1">
          Upgrade to Pro and your receipts will land here.
        </span>
      </div>
    </div>
  );
}
