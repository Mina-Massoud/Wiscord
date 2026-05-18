import { formatRelative } from '@/lib/date';
import { Loader2 } from 'lucide-react';
import { type ActivitySnapshotSummary } from '@/queries/activity-history';
import { DeleteSnapshotDialog } from './ActivityHistoryFloatButtonDeleteSnapshotDialog';

interface SnapshotRowProps {
  snapshot: ActivitySnapshotSummary;
  onLoad: () => void;
  onDelete: () => void;
  loading: boolean;
  deleting: boolean;
}

export function SnapshotRow({
  snapshot,
  onLoad,
  onDelete,
  loading,
  deleting,
}: SnapshotRowProps): React.JSX.Element {
  return (
    <div className="hover:bg-surface-hover group flex items-center gap-2 rounded-md px-2 py-1.5">
      <button
        type="button"
        onClick={onLoad}
        disabled={loading || deleting}
        className="text-ink flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left disabled:opacity-50"
      >
        <span className="text-ink text-tab w-full truncate">{snapshot.title}</span>
        <span className="text-ink-subtle text-badge">{formatRelative(snapshot.createdAt)}</span>
      </button>
      {loading ? (
        <Loader2 className="text-ink-muted size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <DeleteSnapshotDialog title={snapshot.title} deleting={deleting} onConfirm={onDelete} />
      )}
    </div>
  );
}
