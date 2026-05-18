import { useState } from 'react';
import { Clock, Eraser, Loader2, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { formatRelative } from '@/lib/date';
import {
  useActivityHistory,
  useClearActivityScratch,
  useDeleteActivitySnapshot,
  useLoadActivitySnapshot,
  useSaveActivitySnapshot,
  type ActivitySnapshotSummary,
  type HistoryKind,
} from '@/queries/activity-history';

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

interface SnapshotRowProps {
  snapshot: ActivitySnapshotSummary;
  onLoad: () => void;
  onDelete: () => void;
  loading: boolean;
  deleting: boolean;
}

function SnapshotRow({
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

interface DeleteSnapshotDialogProps {
  title: string;
  deleting: boolean;
  onConfirm: () => void;
}

function DeleteSnapshotDialog({
  title,
  deleting,
  onConfirm,
}: DeleteSnapshotDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={deleting}
          className="text-ink-muted hover:text-destructive size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Delete ${title}`}
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-3.5" aria-hidden />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{title}&rdquo;?</DialogTitle>
          <DialogDescription>
            The snapshot is removed from history. The current canvas isn&apos;t affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ClearScratchDialogProps {
  onConfirm: () => void;
}

function ClearScratchDialog({ onConfirm }: ClearScratchDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-full justify-start gap-2"
        >
          <Eraser className="size-3.5" aria-hidden />
          <span className="text-control">Clear canvas</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear the current canvas?</DialogTitle>
          <DialogDescription>
            Everyone in the activity will see a blank canvas. Your saved snapshots are not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Clear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
