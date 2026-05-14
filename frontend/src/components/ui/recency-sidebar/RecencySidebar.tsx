import { useMemo, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar-shell';
import { groupByRecency } from '@/lib/recency';

export interface RecencySidebarProps<T> {
  /** Lead icon for the titlebar (sized by caller). */
  headerIcon?: ReactNode;
  /** Titlebar label. */
  headerTitle: ReactNode;
  /** Label for the primary CTA button. */
  ctaLabel: ReactNode;
  onCreate: () => void;

  /** Items to render, in any order — sorting is handled here. */
  items: readonly T[];
  /** Pull a stable key for `React.key` and selection comparison. */
  getId: (item: T) => string;
  /** ISO string used to bucket and sort items by recency. */
  getUpdatedAt: (item: T) => string;
  /** Renders one item. Selection styling is the caller's choice. */
  renderRow: (item: T, selected: boolean) => ReactNode;

  /** When set, the matching row receives `selected = true`. */
  activeId?: string;

  isLoading: boolean;
  isError: boolean;
  /** Copy for the empty state. */
  emptyMessage: ReactNode;
  /** Copy for the error state. */
  errorMessage: ReactNode;
}

/**
 * Generalized "header + CTA + grouped-by-recency list" sidebar.
 * Notes and Whiteboard share this pattern 1:1; new labs that want the
 * same shape should reach for this instead of cloning the chrome.
 *
 * Bucketing is render-time (anchored to the user's local "now") so
 * reloading the page after midnight re-buckets correctly without
 * needing a stored field.
 */
export function RecencySidebar<T>({
  headerIcon,
  headerTitle,
  ctaLabel,
  onCreate,
  items,
  getId,
  getUpdatedAt,
  renderRow,
  activeId,
  isLoading,
  isError,
  emptyMessage,
  errorMessage,
}: RecencySidebarProps<T>) {
  const groups = useMemo(() => groupByRecency(items, getUpdatedAt), [items, getUpdatedAt]);

  return (
    <Sidebar.Root>
      <Sidebar.Header icon={headerIcon} title={headerTitle} />

      <div className="px-3 pt-3">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full justify-start"
          onClick={onCreate}
        >
          <Plus className="mr-2 size-4" aria-hidden />
          {ctaLabel}
        </Button>
      </div>

      <Sidebar.Body className="gap-3 pt-3">
        {isLoading && <Sidebar.ListSkeleton />}

        {isError && !isLoading && <Sidebar.Empty>{errorMessage}</Sidebar.Empty>}

        {!isLoading && !isError && groups.length === 0 && (
          <Sidebar.Empty>{emptyMessage}</Sidebar.Empty>
        )}

        {!isLoading &&
          !isError &&
          groups.map((group) => (
            <Sidebar.Section key={group.label} title={group.label}>
              {group.items.map((item) => (
                <div key={getId(item)}>{renderRow(item, getId(item) === activeId)}</div>
              ))}
            </Sidebar.Section>
          ))}
      </Sidebar.Body>
    </Sidebar.Root>
  );
}
