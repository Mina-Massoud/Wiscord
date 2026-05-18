import type { FriendRequestDto } from '@/queries/client';
import { RowSkeleton } from './PendingTabRowSkeleton';

interface PendingSectionProps {
  heading: string;
  isLoading: boolean;
  isError: boolean;
  rows: FriendRequestDto[];
  emptyTitle: string;
  renderRow: (req: FriendRequestDto) => React.ReactNode;
}

export function PendingSection({
  heading,
  isLoading,
  isError,
  rows,
  emptyTitle,
  renderRow,
}: PendingSectionProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-ink-muted text-caption mb-2 font-semibold tracking-wider uppercase">
        {heading}
      </h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <p className="text-destructive text-control">Couldn&apos;t load — try again in a sec.</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted text-control">{emptyTitle}</p>
      ) : (
        <div className="flex flex-col">{rows.map(renderRow)}</div>
      )}
    </section>
  );
}
