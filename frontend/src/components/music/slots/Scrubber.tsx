import { formatClock } from './formatClock';

interface ScrubberProps {
  progressMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  /** Viewers can't scrub host playback — render as read-only. */
  readOnly?: boolean;
}

export function Scrubber({
  progressMs,
  durationMs,
  onSeek,
  readOnly = false,
}: ScrubberProps): React.JSX.Element {
  const pct = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0;
  return (
    <div className="flex w-full flex-col gap-1">
      <input
        type="range"
        min={0}
        max={Math.max(0, durationMs)}
        value={progressMs}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Track progress"
        disabled={readOnly}
        className="bg-glass-surface-2 h-1 w-full appearance-none rounded-full accent-white disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`,
        }}
      />
      <div className="text-ink-muted text-badge flex justify-between font-mono">
        <span>{formatClock(progressMs)}</span>
        <span>{durationMs > 0 ? formatClock(durationMs) : '-:--'}</span>
      </div>
    </div>
  );
}
