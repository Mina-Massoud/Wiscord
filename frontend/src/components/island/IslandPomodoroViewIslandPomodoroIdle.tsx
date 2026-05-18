import { Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { type PomodoroPhase } from './usePomodoroStore';
import { formatMmSs } from './IslandPomodoroView';

interface IslandPomodoroIdleProps {
  phase: PomodoroPhase;
  remainingMs: number;
  paused: boolean;
}

/**
 * Compact pomodoro tick (132 × 26). Apple split — timer icon hard-
 * left, mm:ss hard-right. Phase tints the icon so the pill carries
 * the state cue without extra copy.
 */
export function IslandPomodoroIdle({
  phase,
  remainingMs,
  paused,
}: IslandPomodoroIdleProps): React.JSX.Element {
  const isFocus = phase === 'focus';
  return (
    <div className="flex h-full w-full items-center">
      <Timer
        className={cn('size-3.5 shrink-0', isFocus ? 'text-blurple' : 'text-green-400')}
        aria-hidden
      />
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 leading-none">
        {paused ? (
          <span className="text-ink-muted text-badge font-medium uppercase">paused</span>
        ) : null}
        <span className="text-ink text-tab font-bold tabular-nums">{formatMmSs(remainingMs)}</span>
      </div>
    </div>
  );
}
