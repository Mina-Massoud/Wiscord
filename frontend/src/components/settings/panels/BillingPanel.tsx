import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvoices } from '@/queries/billing';
import { SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { InvoiceRow } from './BillingPanelInvoiceRow';
import { EmptyState } from './BillingPanelEmptyState';

export function BillingPanel(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useInvoices();

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
          // M7 — distinct error state. The original "couldn't load…
          // try refreshing the dialog" copy was visually identical
          // to a clean empty list (centered text on whitespace), so
          // users with intermittent errors thought they had no
          // invoices. The destructive-tinted card + retry button
          // makes the failure unmistakable + recoverable in-place.
          <div className="border-destructive/40 bg-destructive/10 flex items-start gap-3 rounded-md border px-4 py-3">
            <AlertCircle className="text-destructive size-5 shrink-0" aria-hidden />
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-destructive text-control">couldn&apos;t load your invoices.</p>
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => void refetch()}
              >
                try again
              </Button>
            </div>
          </div>
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
