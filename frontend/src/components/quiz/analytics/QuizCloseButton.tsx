import { useState } from 'react';
import { Loader2, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { quizGenZ } from '@/lib/copy/quiz-genz';
import { toast } from '@/lib/toast';
import { useCloseQuiz } from '@/queries/quiz';

interface QuizCloseButtonProps {
  quizId: string;
  status: string;
}

/**
 * Host-only "wrap it up" control. Hidden once the quiz is already closed.
 * The confirm step goes through a `<Dialog>` rather than a hand-built
 * confirm — closing is irreversible (participants can no longer submit),
 * so the extra tap is justified.
 */
export function QuizCloseButton({
  quizId,
  status,
}: QuizCloseButtonProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const closeQuiz = useCloseQuiz(quizId);

  if (status === 'closed') return null;

  const handleConfirm = async (): Promise<void> => {
    try {
      await closeQuiz.mutateAsync();
      toast.success(quizGenZ.closeQuiz.successToast);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : quizGenZ.closeQuiz.errorToast;
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Square className="size-4" aria-hidden />
          {quizGenZ.closeQuiz.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface-2 border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-ink text-subhead">
            {quizGenZ.closeQuiz.confirmTitle}
          </DialogTitle>
          <DialogDescription className="text-ink-muted text-caption">
            {quizGenZ.closeQuiz.confirmBody}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={closeQuiz.isPending}>
            {quizGenZ.closeQuiz.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={closeQuiz.isPending}
          >
            {closeQuiz.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {closeQuiz.isPending
              ? quizGenZ.closeQuiz.pendingTrigger
              : quizGenZ.closeQuiz.confirmCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
