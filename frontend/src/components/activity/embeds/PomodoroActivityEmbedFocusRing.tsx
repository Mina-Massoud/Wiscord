import { cn } from '@/lib/cn';
import type { PomodoroSnapshot } from '@/queries/client';

interface FocusRingProps {
  /** 0 → 1. 0 = full phase remaining, 1 = phase complete. */
  progress: number;
  phase: PomodoroSnapshot['phase'];
  paused: boolean;
  /** Pre-formatted `MM:SS` from the parent. */
  time: string;
  round: number;
  totalRounds: number;
}

/**
 * Centered SVG focus ring. Three layered visual elements:
 *
 *   1. Outer dotted ambient ring — pure decoration (WHOOP-style),
 *      gives the hero a "field of attention" rather than a flat dial.
 *   2. Main progress ring — fixed dim track + colored stroke that
 *      reveals clockwise from 12 o'clock via stroke-dashoffset. CSS
 *      transition smooths the 1s-tick jump into a linear sweep.
 *   3. Leading-edge glow dot — a small circle riding the head of the
 *      filled arc. Boxed with a wide blur shadow so it reads as a
 *      glowing tip, not a UI handle.
 *
 * Timer numerals + round meta sit dead-center inside the ring. The
 * `paused` flag swaps the inner subtitle to a pulsing "paused" tag
 * so users know why the seconds aren't moving.
 */
export function FocusRing({
  progress,
  phase,
  paused,
  time,
  round,
  totalRounds,
}: FocusRingProps): React.JSX.Element {
  const isFocus = phase === 'focus';
  const size = 240;
  const center = size / 2;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  // Dot rides the head of the filled arc. 0 progress → 12 o'clock,
  // 0.5 → 6 o'clock, 1 → back to 12. CSS rotate around the ring
  // center; 1s linear transition smooths between integer ticks.
  const dotAngle = progress * 360;
  const strokeColor = isFocus ? '#5865F2' : '#57F287';
  const glowRgb = isFocus ? '88, 101, 242' : '87, 242, 135';

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer dotted ambient ring — WHOOP-style. Pure decoration,
            sits ~12px outside the main ring, very low alpha. */}
        <svg
          aria-hidden
          className="absolute inset-0"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius + 12}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={1}
            strokeDasharray="2 6"
          />
        </svg>

        {/* Main progress ring. Rotated -90° so dasharray starts at
            12 o'clock instead of 3. */}
        <svg
          aria-hidden
          className="absolute inset-0 -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={4}
          />
          {/* Filled arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1s linear',
              filter: `drop-shadow(0 0 8px rgba(${glowRgb}, 0.55))`,
            }}
          />
        </svg>

        {/* Leading-edge glow dot — CSS rotation around the ring
            center keeps it on the rim. transformOrigin defaults to
            center of the wrapper. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `rotate(${dotAngle}deg)`,
            transition: 'transform 1s linear',
          }}
        >
          <div
            className={cn(
              'absolute left-1/2 size-3 -translate-x-1/2 rounded-full',
              paused && 'animate-pulse',
            )}
            style={{
              top: center - radius - 6,
              backgroundColor: strokeColor,
              boxShadow: `0 0 16px 4px rgba(${glowRgb}, 0.7), 0 0 32px 8px rgba(${glowRgb}, 0.35)`,
            }}
          />
        </div>

        {/* Timer text — dead center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span
            className={cn(
              'text-badge font-semibold tracking-[0.18em] uppercase',
              isFocus ? 'text-blurple' : 'text-green-400',
            )}
          >
            {isFocus ? 'Focus' : 'Break'}
          </span>
          <span className="text-ink text-[44px] leading-none font-bold tabular-nums">{time}</span>
          {paused ? (
            <span className="text-badge font-medium tracking-wider text-amber-300 uppercase">
              paused
            </span>
          ) : (
            <span className="text-ink-muted text-badge tracking-wider uppercase">
              round {round}/{totalRounds}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
