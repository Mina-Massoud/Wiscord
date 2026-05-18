import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface UnsavedBarProps {
  submitting: boolean;
  onReset: () => void;
  onSave: () => void;
}

export function UnsavedBar({ submitting, onReset, onSave }: UnsavedBarProps): React.JSX.Element {
  return (
    <div className="bg-glass-surface-2 border-glass-border absolute right-10 bottom-6 left-10 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg">
      <p className="text-ink text-control flex-1">Careful — you have unsaved changes!</p>
      <Button variant="ghost" onClick={onReset} disabled={submitting}>
        Reset
      </Button>
      <Button onClick={onSave} disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Save Changes
      </Button>
    </div>
  );
}
