import type { PomodoroSnapshot } from '@/queries/client';
import { cn } from '@/lib/cn';
import { getSharedRemainingMs } from './DynamicIsland';

function formatSharedMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Shared-session card rendered inside the island when the user has
 * opted into a voice-channel pomodoro. Apple-DI horizontal grammar
 * (Forest / Opal / Duolingo / Apple Fitness all use this exact
 * left-right split for their expanded Live Activities):
 *
 *   [emblem]   FOCUS · room session             [× close]
 *              15:40
 *              round 1/4 · synced with the room
 *
 * The emblem on the left is a 64px circle with a small SVG progress
 * ring around it that ticks counter-clockwise as the timer elapses.
 * Phase-tinted; pulses when paused. Acts as a glanceable status
 * indicator without leaning on the giant centered hero.
 *
 * Full host controls + reset-request flow live in the voice channel
 * activity area (`PomodoroActivityEmbed`). The island just mirrors
 * the room's countdown so the user can glance without leaving
 * whatever page they're on.
 */
export function SharedPomodoroCard({
  pomodoro,
  nowMs,
  onClose,
}: {
  pomodoro: PomodoroSnapshot;
  nowMs: number;
  onClose: () => void;
}): React.JSX.Element {
  const remainingMs = getSharedRemainingMs(pomodoro, nowMs);
  const time = formatSharedMmSs(remainingMs);
  const isFocus = pomodoro.phase === 'focus';
  const paused = pomodoro.endsAt === null && pomodoro.pausedRemainingMs !== null;
  const phaseTotalMs = isFocus ? 25 * 60 * 1000 : 5 * 60 * 1000;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / phaseTotalMs));
  const strokeColor = isFocus ? '#5865F2' : '#57F287';
  const glowRgb = isFocus ? '88, 101, 242' : '87, 242, 135';
  const emblemSize = 72;
  const ringRadius = 32;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="flex h-full w-full items-center gap-4">
      {/* LEFT — emblem with progress ring */}
      <div className="relative shrink-0" style={{ width: emblemSize, height: emblemSize }}>
        {/* SVG ring (track + filled stroke) */}
        <svg
          aria-hidden
          className="absolute inset-0 -rotate-90"
          width={emblemSize}
          height={emblemSize}
          viewBox={`0 0 ${emblemSize} ${emblemSize}`}
        >
          <circle
            cx={emblemSize / 2}
            cy={emblemSize / 2}
            r={ringRadius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={3}
          />
          <circle
            cx={emblemSize / 2}
            cy={emblemSize / 2}
            r={ringRadius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringCircumference * (1 - progress)}
            style={{
              transition: 'stroke-dashoffset 1s linear',
              filter: `drop-shadow(0 0 6px rgba(${glowRgb}, 0.55))`,
            }}
          />
        </svg>
        {/* Inner phase dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden
            className={cn(
              'size-3 rounded-full',
              isFocus ? 'bg-blurple' : 'bg-green-400',
              paused && 'animate-pulse',
            )}
            style={{
              boxShadow: `0 0 12px 3px rgba(${glowRgb}, 0.55)`,
            }}
          />
        </div>
      </div>

      {/* MIDDLE — phase chip + giant time + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-ink text-badge font-semibold tracking-[0.16em] uppercase">
            {isFocus ? 'Focus' : 'Break'} · room session
          </span>
        </div>
        <p className="text-ink text-hero font-bold tabular-nums">{time}</p>
        <p className="text-ink-muted text-badge tracking-wider uppercase">
          Round {pomodoro.round}/{pomodoro.totalRounds}
          {paused ? (
            <span className="ml-2 font-semibold text-amber-300">· paused</span>
          ) : (
            <span className="ml-2">· synced with the room</span>
          )}
        </p>
      </div>

      {/* RIGHT — close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-ink-muted hover:text-ink shrink-0 rounded-full p-2 transition-colors hover:bg-white/5"
      >
        <span aria-hidden className="text-tab block leading-none">
          ×
        </span>
      </button>
    </div>
  );
}
