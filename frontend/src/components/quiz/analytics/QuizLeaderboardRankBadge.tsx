import { Crown } from 'lucide-react';
import { cn } from '@/lib/cn';

export function RankBadge({ rank }: { rank: number }): React.JSX.Element {
  if (rank === 1) {
    return (
      <span
        className="bg-warning/15 text-warning rounded-pill flex size-7 shrink-0 items-center justify-center"
        aria-label="First place"
      >
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'text-badge rounded-pill flex size-7 shrink-0 items-center justify-center font-semibold',
        rank === 2 && 'bg-ink-muted/20 text-ink',
        rank === 3 && 'bg-warning/10 text-warning',
        rank > 3 && 'bg-glass-callout text-ink-muted',
      )}
    >
      {rank}
    </span>
  );
}
