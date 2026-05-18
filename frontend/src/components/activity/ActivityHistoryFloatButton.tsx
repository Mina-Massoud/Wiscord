import { useState } from 'react';
import { Clock, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import {
  useActivityHistory,
  useClearActivityScratch,
  useDeleteActivitySnapshot,
  useLoadActivitySnapshot,
  useSaveActivitySnapshot,
  type ActivitySnapshotSummary,
  type HistoryKind,
} from '@/queries/activity-history';
import { SnapshotRow } from './ActivityHistoryFloatButtonSnapshotRow';
import { ClearScratchDialog } from './ActivityHistoryFloatButtonClearScratchDialog';

interface ActivityHistoryFloatButtonProps {
  kind: HistoryKind;
  channelId: string;
}

/**
 * Top-right floating button that opens a history panel for a scratch-style
 * activity (Notes / Whiteboard).
 *
 * Interactions:
 *  - Save → freezes current scratch into a new snapshot (auto-titled)
 *  - Pick a snapshot → loads it into the live editor; connected clients
 *    reconnect to the new state
 *  - Trash → deletes a snapshot (confirm dialog so a stray click can't
 *    wipe a saved board)
 *  - Clear scratch → wipes the live editor back to blank (confirm dialog,
 *    destructive)
 *
 * The scratch keeps auto-syncing for collaboration; this button only
 * surfaces the *named* snapshot history layered on top.
 */
export function ActivityHistoryFloatButton({
  kind,
  channelId,
}: ActivityHistoryFloatButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const history = useActivityHistory(kind, channelId);
  const saveMutation = useSaveActivitySnapshot();
  const loadMutation = useLoadActivitySnapshot();
  const deleteMutation = useDeleteActivitySnapshot();
  const clearMutation = useClearActivityScratch();

  const handleSave = (): void => {
    saveMutation.mutate(
      { kind, channelId },
      {
        onSuccess: () => toast.success('Saved to history'),
        onError: (err) => toast.error(err.message || "Couldn't save snapshot"),
      },
    );
  };

  const handleLoad = (snapshot: ActivitySnapshotSummary): void => {
    loadMutation.mutate(
      { kind, channelId, snapshotId: snapshot.id },
      {
        onSuccess: () => {
          toast.success(`Loaded "${snapshot.title}"`);
          setOpen(false);
        },
        onError: (err) => toast.error(err.message || "Couldn't load snapshot"),
      },
    );
  };

  const handleDelete = (snapshot: ActivitySnapshotSummary): void => {
    deleteMutation.mutate(
      { kind, channelId, snapshotId: snapshot.id },
      {
        onSuccess: () => toast.info(`Deleted "${snapshot.title}"`),
        onError: (err) => toast.error(err.message || "Couldn't delete snapshot"),
      },
    );
  };

  const handleClear = (): void => {
    clearMutation.mutate(
      { kind, channelId },
      {
        onSuccess: () => {
          toast.info('Canvas cleared');
          setOpen(false);
        },
        onError: (err) => toast.error(err.message || "Couldn't clear canvas"),
      },
    );
  };

  const snapshots = history.data ?? [];

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-30">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="bg-glass-surface-2 border-glass-border shadow-glass backdrop-blur-glass-sm pointer-events-auto h-9 gap-1.5 rounded-full border px-3"
            aria-label="Snapshots and history"
          >
            <Clock className="size-4" aria-hidden />
            <span className="text-control">History</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="bg-glass-surface-2 border-glass-border shadow-glass pointer-events-auto w-80 origin-top-right gap-0 overflow-hidden rounded-lg p-0"
        >
          <div className="border-glass-border flex items-center justify-between gap-2 border-b px-4 py-3">
            <p className="text-ink text-tab font-semibold">Snapshots</p>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="rounded-pill h-7 gap-1 px-3"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="size-3.5" aria-hidden />
              )}
              <span className="text-badge">Save</span>
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {history.isLoading ? (
              <div className="flex flex-col gap-1 px-2 py-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : history.isError ? (
              <div className="text-ink-muted text-caption px-4 py-6 text-center">
                Couldn&apos;t load history.
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-ink-muted text-caption px-4 py-6 text-center">
                No snapshots yet. Click Save to keep a copy of the current canvas.
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5 px-1">
                {snapshots.map((snapshot) => (
                  <li key={snapshot.id}>
                    <SnapshotRow
                      snapshot={snapshot}
                      onLoad={() => handleLoad(snapshot)}
                      onDelete={() => handleDelete(snapshot)}
                      loading={
                        loadMutation.isPending && loadMutation.variables?.snapshotId === snapshot.id
                      }
                      deleting={
                        deleteMutation.isPending &&
                        deleteMutation.variables?.snapshotId === snapshot.id
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-glass-border border-t px-2 py-2">
            <ClearScratchDialog onConfirm={handleClear} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
