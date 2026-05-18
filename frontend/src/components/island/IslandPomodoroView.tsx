import { Flame, Pause, Play, Quote, SkipForward, Square, Timer } from 'lucide-react';

import { cn } from '@/lib/cn';

import { type PomodoroPhase, getPomodoroTotalSeconds } from './usePomodoroStore';
import { pickBreakTip, pickEgoQuote, pickFocusTip } from './pomodoroVibes';

interface IslandPomodoroViewProps {
  phase: PomodoroPhase;
  round: number;
  totalRounds: number;
  remainingMs: number;
  paused: boolean;
  sessionsCompletedToday: number;
  minutesFocusedToday: number;
  streakDays: number;
  /** Wall-clock now-ms — drives the rotating quote/tip buckets. The
   *  parent already ticks this every second while the timer runs, so
   *  the view re-renders on the same cadence and the buckets advance
   *  naturally without needing an internal interval. */
  nowMs: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onEnd: () => void;
}

/**
 * Expanded pomodoro card. Keeps the *old compact-card grammar* —
 * giant timer pinned hard-left, control cluster hard-right — and
 * extends downward with stats + a rotating vibe block.
 *
 *   row 1   phase chip · round            · close
 *   row 2   GIANT TIME + subtitle         · Pause + Skip
 *   row 3   stat tiles: today / focused / streak
 *   row 4   quote card (ego flavor)
 *   row 5   one-line practical tip
 *
 * Quote and tip are seeded off round + sessions-today so they stay
 * constant across renders within one phase and rotate between
 * sessions.
 */
export function IslandPomodoroView({
  phase,
  round,
  totalRounds,
  remainingMs,
  paused,
  sessionsCompletedToday,
  minutesFocusedToday,
  streakDays,
  nowMs,
  onPause,
  onResume,
  onSkip,
  onEnd,
}: IslandPomodoroViewProps): React.JSX.Element {
  const time = formatMmSs(remainingMs);
  const isFocus = phase === 'focus';
  const ctx = { round, sessionsCompletedToday, nowMs };
  const quote = pickEgoQuote(ctx);
  const tip = isFocus ? pickFocusTip(ctx) : pickBreakTip(ctx);

  return (
    <div className="flex h-full w-full flex-col">
      {/* row 1 — phase chip + round + close */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'size-2 rounded-full',
              isFocus ? 'bg-blurple' : 'bg-green-400',
              paused && 'animate-pulse',
            )}
          />
          <span className="text-ink text-badge font-semibold tracking-wider uppercase">
            {isFocus ? 'Focus' : 'Break'}
          </span>
          <span className="text-ink-muted text-badge tabular-nums">
            · round {round}/{totalRounds}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnd();
          }}
          aria-label="End pomodoro session"
          className="text-ink-muted hover:text-ink rounded-md p-1.5 transition-colors hover:bg-white/5"
        >
          <Square strokeWidth={1.6} size={16} />
        </button>
      </div>

      {/* row 2 — time on the LEFT, controls on the RIGHT (the grammar
                 from the old compact card, just at this larger size) */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-ink text-[56px] leading-none font-bold tabular-nums">{time}</p>
          <p className="text-ink-muted text-xs">
            <Timer aria-hidden className="mr-1 inline size-3 -translate-y-px" />
            {totalLabel(phase)}
            {paused ? <span className="ml-2 font-semibold text-amber-300">paused</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (paused) onResume();
              else onPause();
            }}
            aria-label={paused ? 'Resume timer' : 'Pause timer'}
            className="bg-blurple hover:bg-blurple/90 text-blurple-foreground inline-flex h-10 min-w-[104px] items-center justify-center gap-1.5 rounded-full px-4 font-semibold transition-colors"
          >
            {paused ? <Play strokeWidth={2} size={16} /> : <Pause strokeWidth={2} size={16} />}
            <span className="text-control">{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            aria-label="Skip to next phase"
            className="text-ink-muted hover:text-ink inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <SkipForward strokeWidth={1.75} size={16} />
          </button>
        </div>
      </div>

      {/* row 3 — stats strip */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Today" value={sessionsCompletedToday} suffix="sessions" />
        <StatTile label="Focused" value={minutesFocusedToday} suffix="min" />
        <StatTile
          label="Streak"
          value={streakDays}
          suffix={streakDays === 1 ? 'day' : 'days'}
          icon={<Flame className="size-3.5 text-amber-400" aria-hidden />}
        />
      </div>

      {/* row 4 — ego quote */}
      <div className="bg-blurple/10 border-blurple/20 mt-3 rounded-md border px-3 py-2">
        <div className="flex items-start gap-2">
          <Quote className="text-blurple/70 mt-0.5 size-3 shrink-0" aria-hidden />
          <p className="text-ink text-xs leading-snug italic">{quote}</p>
        </div>
      </div>

      {/* row 5 — one-line tip */}
      <p className="text-ink-muted mt-2 px-1 text-[11px] leading-snug">
        <span className="text-ink-muted font-semibold tracking-wider uppercase">tip · </span>
        {tip}
      </p>
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  suffix: string;
  icon?: React.ReactNode;
}

function StatTile({ label, value, suffix, icon }: StatTileProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-md bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-ink-muted text-badge font-semibold tracking-wider uppercase">
          {label}
        </span>
      </div>
      <p className="text-ink text-tab leading-none font-bold tabular-nums">
        {value}
        <span className="text-ink-muted ml-1 text-[10px] font-medium">{suffix}</span>
      </p>
    </div>
  );
}

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

function totalLabel(phase: PomodoroPhase): string {
  const totalSec = getPomodoroTotalSeconds(phase);
  return `${Math.round(totalSec / 60)} min ${phase}`;
}

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
