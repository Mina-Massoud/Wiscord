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
import { toast } from '@/lib/toast';
import { useLaunchQuiz } from '@/queries/quiz';
import type { QuizMode } from '@/types/quiz';
import { ModeTile } from './QuizLaunchDialogModeTile';

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
