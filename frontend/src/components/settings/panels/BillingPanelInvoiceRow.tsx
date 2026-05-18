import { type Invoice } from '@/queries/billing';
import { Download, ExternalLink } from 'lucide-react';
import { StatusPill } from './BillingPanelStatusPill';

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

export function InvoiceRow({ invoice }: { invoice: Invoice }): React.JSX.Element {
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
