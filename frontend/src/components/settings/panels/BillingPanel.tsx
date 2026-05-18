import { Skeleton } from '@/components/ui/skeleton';
import { useInvoices } from '@/queries/billing';
import { SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { InvoiceRow } from './BillingPanelInvoiceRow';
import { EmptyState } from './BillingPanelEmptyState';

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
