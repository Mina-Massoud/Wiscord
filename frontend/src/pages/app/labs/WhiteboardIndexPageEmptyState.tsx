import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="border-glass-border flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <span
        aria-hidden
        className="bg-glass-surface-1 border-glass-border flex size-16 items-center justify-center rounded-full border"
      >
        <Pencil className="text-ink-muted size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-ink text-subhead font-semibold">No whiteboards yet</h3>
        <p className="text-ink-muted text-caption max-w-sm">
          Spin up a fresh canvas to start sketching ideas. Boards stay around as soon as you drop
          your first stroke.
        </p>
      </div>
      <Button type="button" onClick={onCreate}>
        <Plus className="mr-2 size-4" aria-hidden />
        New whiteboard
      </Button>
    </div>
  );
}
