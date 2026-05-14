import { useState } from 'react';
import { Loader2, Play, Radio, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { useLaunchQuiz } from '@/queries/quiz';
import type { QuizMode } from '@/types/quiz';

interface QuizLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  quizTitle: string;
  onLaunched: (mode: QuizMode) => void;
}

/**
 * Launch dialog. Host picks live or async; we POST /quiz/:id/launch and
 * navigate the parent to the player surface on success. Per the design
 * rules, no magic icons — Radio for live (broadcast), Timer for async.
 */
export function QuizLaunchDialog({
  open,
  onOpenChange,
  quizId,
  quizTitle,
  onLaunched,
}: QuizLaunchDialogProps): React.JSX.Element {
  const [mode, setMode] = useState<QuizMode>('live');
  const launch = useLaunchQuiz(quizId);

  const handleLaunch = (): void => {
    launch.mutate(
      { mode },
      {
        onSuccess: () => {
          toast.success(mode === 'live' ? 'Quiz is live' : 'Quiz is open');
          onLaunched(mode);
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message || "Couldn't launch the quiz");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-2 border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-ink text-subhead">Launch quiz</DialogTitle>
          <DialogDescription className="text-ink-muted text-caption">
            Pick how participants take{' '}
            <span className="text-ink font-medium">{quizTitle || 'this quiz'}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <ModeTile
            selected={mode === 'live'}
            onSelect={() => setMode('live')}
            icon={<Radio className="size-5" aria-hidden />}
            label="Live"
            description="Everyone answers in sync. Best for study sessions."
          />
          <ModeTile
            selected={mode === 'async'}
            onSelect={() => setMode('async')}
            icon={<Timer className="size-5" aria-hidden />}
            label="Async"
            description="Participants take it whenever. Closes when you say so."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={launch.isPending}>
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={launch.isPending}>
            {launch.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="mr-2 size-4" aria-hidden />
            )}
            Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ModeTileProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function ModeTile({
  selected,
  onSelect,
  icon,
  label,
  description,
}: ModeTileProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'border-glass-border bg-glass-surface-1 hover:border-glass-border-strong text-ink flex items-start gap-3 rounded-md border p-4 text-left transition-colors',
        'focus-visible:ring-blurple focus-visible:ring-offset-canvas focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        selected && 'border-blurple bg-blurple/10 ring-blurple ring-1',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'bg-surface-composer text-ink-muted flex size-9 shrink-0 items-center justify-center rounded-md',
          selected && 'bg-blurple/20 text-blurple',
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-control font-semibold">{label}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </span>
    </button>
  );
}
