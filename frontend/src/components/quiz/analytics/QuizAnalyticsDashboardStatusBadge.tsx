import { quizGenZ } from '@/lib/copy/quiz-genz';
import { cn } from '@/lib/cn';
import { Radio } from 'lucide-react';

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const isLive = status === 'live';
  const isClosed = status === 'closed';
  const label = isLive ? quizGenZ.liveBadge : isClosed ? quizGenZ.closedBadge : status;
  return (
    <span
      className={cn(
        'text-badge rounded-pill inline-flex w-fit items-center gap-1.5 px-2 py-0.5 font-semibold tracking-wider uppercase',
        isLive && 'bg-destructive/15 text-destructive',
        isClosed && 'bg-ink-muted/15 text-ink-muted',
        !isLive && !isClosed && 'bg-blurple/15 text-blurple',
      )}
    >
      {isLive && <Radio className="size-3 animate-pulse" aria-hidden />}
      {label}
    </span>
  );
}
