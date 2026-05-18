import { cn } from '@/lib/cn';

interface MusicWaveformProps {
  /** Number of bars rendered. 14–24 reads well; smaller for tight strips. */
  bars?: number;
  /** When false, bars freeze at their current heights (no JS work). */
  active: boolean;
  className?: string;
}

/**
 * Animated music-bars waveform — pure CSS, no React state, no rAF. Each
 * bar runs the same keyframe with a staggered `animation-delay` so the
 * row reads as a traveling wave. When `active` flips false we set
 * `animation-play-state: paused`, freezing bars at their current height
 * without unmounting or restarting.
 *
 * Why pure CSS: an earlier `setState`-driven version forced a React
 * re-render of the capsule every ~32ms, which competed with Framer
 * Motion's layout morph and made expand/collapse stutter. Keyframes run
 * on the compositor, off the main thread.
 */
export function MusicWaveform({
  bars = 24,
  active,
  className,
}: MusicWaveformProps): React.JSX.Element {
  return (
    <div aria-hidden className={cn('flex items-end gap-[2px]', className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          // `currentColor` so the caller controls hue via `text-*`.
          // Defaults read as ink — pass `text-success` for the green
          // playing indicator on the now-playing card.
          className="inline-block w-[2px] rounded-full bg-current"
          style={{
            animation: 'music-wave-bar 1.1s ease-in-out infinite',
            animationDelay: `${(i * -80) % 1100}ms`,
            animationPlayState: active ? 'running' : 'paused',
            // Start height — visible when paused before the animation
            // has even painted a frame (e.g. SSR / instant mount).
            height: '40%',
          }}
        />
      ))}
    </div>
  );
}
