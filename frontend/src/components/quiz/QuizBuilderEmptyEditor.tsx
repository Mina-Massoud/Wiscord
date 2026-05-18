import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

export function EmptyEditor({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="bg-glass-surface-1 border-glass-border flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-12 text-center">
      <h2 className="text-ink text-subhead font-semibold">Build the first question</h2>
      <p className="text-ink-muted text-caption">
        Pick a type, write the prompt, and the preview on the right updates as you type.
      </p>
      <Button onClick={onAdd}>
        <Play className="mr-2 size-4" aria-hidden />
        Add a question
      </Button>
    </div>
  );
}
