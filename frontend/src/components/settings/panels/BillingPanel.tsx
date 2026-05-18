import { Download, ExternalLink, Receipt } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useInvoices, type Invoice } from '@/queries/billing';
import { SettingsPanelTitle, SettingsSection } from '../SettingsShell';

export function BillingPanel(): React.JSX.Element {
  const { data, isLoading, error } = useInvoices();

  return (
    <div>
      <SettingsPanelTitle>Billing History</SettingsPanelTitle>

      <SettingsSection
        title="Invoices"
        description="Every payment processed through Stripe. Tap an invoice to open or download it."
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <p className="text-destructive text-control">
            Couldn&apos;t load your invoices. Try refreshing the dialog.
          </p>
        ) : !data || data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="border-glass-border overflow-hidden rounded-md border">
            <div className="border-glass-border text-ink-muted text-caption grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b px-4 py-2 font-semibold tracking-wider uppercase">
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="flex flex-col">
              {data.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </ul>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }): React.JSX.Element {
  const formattedAmount = formatCurrency(invoice.amountPaid, invoice.currency);
  return (
    <li className="hover:bg-glass-hover border-glass-border grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b px-4 py-3 last:border-b-0">
      <span className="text-ink text-control truncate">
        {formatDate(invoice.periodStart ?? invoice.createdAt)}
      </span>
      <span className="text-ink text-control tabular-nums">{formattedAmount}</span>
      <StatusPill status={invoice.status} />
      <span className="flex items-center gap-1">
        {invoice.hostedInvoiceUrl ? (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open invoice"
            className="text-ink-muted hover:bg-glass-hover hover:text-ink flex size-8 items-center justify-center rounded-md transition-colors"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        ) : null}
        {invoice.invoicePdf ? (
          <a
            href={invoice.invoicePdf}
            target="_blank"
            rel="noreferrer"
            aria-label="Download PDF"
            className="text-ink-muted hover:bg-glass-hover hover:text-ink flex size-8 items-center justify-center rounded-md transition-colors"
          >
            <Download className="size-4" aria-hidden />
          </a>
        ) : null}
      </span>
    </li>
  );
}

function StatusPill({ status }: { status: Invoice['status'] }): React.JSX.Element {
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

function EmptyState(): React.JSX.Element {
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

function formatCurrency(amountInCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountInCents / 100);
  } catch {
    return `${(amountInCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
