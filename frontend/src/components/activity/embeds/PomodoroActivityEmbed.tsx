import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pause, Play, RotateCcw, SkipForward, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import type { PomodoroSnapshot } from '@/queries/client';
import { usePomodoroControl } from '@/queries/voice-activity';
import { pickBreakTip, pickEgoQuote, pickFocusTip } from '@/components/island/pomodoroVibes';
import { FocusRing } from './PomodoroActivityEmbedFocusRing';

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;

interface PomodoroActivityEmbedProps {
  channelId: string;
  pomodoro: PomodoroSnapshot;
  /** True when the local user is the host (controls enabled). */
  isHost: boolean;
  /** Display name for the current host — shown in the header line. */
  hostDisplayName: string;
  /** How many people are currently in this voice channel — shown as
   *  social proof under the timer. */
  participantCount: number;
  /** Display name of the user who sent the pending reset request,
   *  if any. Used by the host-side inline banner. */
  resetRequesterName: string | null;
  /** Called when the host taps "End" — usually wired to `stopActivity`. */
  onEnd?: () => void;
}

/**
 * Shared-pomodoro activity embed. Renders inside the voice channel's
 * activity area; everyone in the room sees the same countdown, anchored
 * to a server `endsAt`. Layout mirrors the old island card grammar
 * (giant time hard-left, controls hard-right) but at the larger
 * activity-area size, and adds:
 *
 *   - Phase chip + round + hosted-by line
 *   - Reset-request inline banner (host-side) with gen-z framing
 *   - "Ask host to reset" affordance (participant-side)
 *   - Stats line ("👥 N locked in") instead of personal counters —
 *     this is a shared session, the count of teammates is the relevant
 *     stat. Personal stats stay in the island for the solo flow.
 *   - Rotating quote + tip from pomodoroVibes
 */
export function PomodoroActivityEmbed({
  channelId,
  pomodoro,
  isHost,
  hostDisplayName,
  participantCount,
  resetRequesterName,
  onEnd,
}: PomodoroActivityEmbedProps): React.JSX.Element {
  const control = usePomodoroControl();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // 1s tick while the timer is running so the countdown stays current.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => getRemainingMs(pomodoro, nowMs), [pomodoro, nowMs]);
  const paused = pomodoro.endsAt === null && pomodoro.pausedRemainingMs !== null;
  const time = formatMmSs(remainingMs);
  const isFocus = pomodoro.phase === 'focus';

  // Progress 0→1 across the current phase. Drives the radial-gradient
  // fill — the background starts as a soft pinprick of color near the
  // top-right and expands outward as the timer counts down. When the
  // countdown hits zero, the whole card is bathed in the phase color.
  // Two tiny modulations keep it alive between ticks:
  //   - `centerX/Y` drift via sin/cos so the bloom doesn't sit still
  //   - `pulseScale` micro-breathes on the inner stop alpha (~5%)
  const phaseTotalMs = isFocus ? FOCUS_MS : BREAK_MS;
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / phaseTotalMs));
  const centerX = 50 + Math.sin(nowMs / 6_500) * 12;
  const centerY = 45 + Math.cos(nowMs / 8_300) * 14;
  const pulseScale = 1 + Math.sin(nowMs / 1_800) * 0.04;
  // Phase color in raw RGB so we can interpolate alpha at runtime.
  const phaseRgb = isFocus ? '88, 101, 242' : '87, 242, 135'; // blurple / green
  const innerAlpha = (0.18 + progress * 0.28) * pulseScale;
  const midAlpha = 0.08 + progress * 0.16;
  const innerRadius = 18 + progress * 14;
  const outerRadius = 45 + progress * 45;
  const bloomStyle = {
    backgroundImage: `radial-gradient(
      circle at ${centerX}% ${centerY}%,
      rgba(${phaseRgb}, ${innerAlpha}) 0%,
      rgba(${phaseRgb}, ${midAlpha}) ${innerRadius}%,
      rgba(${phaseRgb}, 0) ${outerRadius}%
    )`,
  } as const;

  const vibeCtx = {
    round: pomodoro.round,
    sessionsCompletedToday: 0, // not relevant in shared mode; counter rotates by round + nowMs bucket only
    nowMs,
  };
  const quote = pickEgoQuote(vibeCtx);
  const tip = isFocus ? pickFocusTip(vibeCtx) : pickBreakTip(vibeCtx);

  const hasPendingResetRequest = pomodoro.resetRequest !== null;

  const fire = (
    input:
      | { action: 'pause' | 'resume' | 'skip' | 'requestReset' }
      | { action: 'respondReset'; accept: boolean },
  ): void => {
    control.mutate({ channelId, ...input } as Parameters<typeof control.mutate>[0]);
  };

  const onRequestReset = (): void => {
    fire({ action: 'requestReset' });
    toast.info('Reset request sent to the host', {
      description: 'They get 30 seconds to decide.',
    });
  };

  return (
    <motion.div
      key={`pomodoro-${pomodoro.round}-${pomodoro.phase}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full w-full flex-col gap-4 overflow-hidden p-5"
    >
      {/* Progress-tracked radial bloom. As the timer counts down, the
          glow expands outward + ticks alpha up; at 0:00 the whole card
          is bathed in the phase color. Drifts slowly via sin/cos to
          stay alive between integer-second ticks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background-image] duration-1000 ease-out"
        style={bloomStyle}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(${phaseRgb}, 0) 60%, rgba(${phaseRgb}, ${0.04 + progress * 0.1}) 100%)`,
        }}
      />

      {/* Content sits above the gradient layers */}
      <div className="relative z-10 flex h-full w-full flex-col gap-4">
        {/* Header */}
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
            <span className="text-ink text-control font-semibold tracking-wider uppercase">
              {isFocus ? 'Focus' : 'Break'}
            </span>
            <span className="text-ink-muted text-caption tabular-nums">
              · round {pomodoro.round}/{pomodoro.totalRounds}
            </span>
            <span className="text-ink-muted text-caption">· hosted by {hostDisplayName}</span>
          </div>
          {isHost ? (
            <button
              type="button"
              onClick={onEnd}
              aria-label="End focus session"
              className="text-ink-muted hover:text-ink rounded-md p-1.5 transition-colors hover:bg-white/5"
            >
              <Square strokeWidth={1.6} size={16} />
            </button>
          ) : null}
        </div>

        {/* Reset-request banner (host-side only) */}
        {isHost && hasPendingResetRequest ? (
          <div className="bg-blurple/10 border-blurple/30 flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <RotateCcw className="text-blurple size-4 shrink-0" aria-hidden />
            <p className="text-ink text-caption flex-1 leading-snug">
              <span className="font-semibold">{resetRequesterName ?? 'someone'}</span> wants a fresh
              start. Reset the clock back to 25:00?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-ink-muted hover:text-ink h-8"
                onClick={() => fire({ action: 'respondReset', accept: false })}
                disabled={control.isPending}
              >
                <X strokeWidth={2} size={14} aria-hidden />
                Nah
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-blurple hover:bg-blurple/90 text-blurple-foreground h-8"
                onClick={() => fire({ action: 'respondReset', accept: true })}
                disabled={control.isPending}
              >
                <Check strokeWidth={2.25} size={14} aria-hidden />
                Reset, bet
              </Button>
            </div>
          </div>
        ) : null}

        {/* Reset-pending banner (participant-side, after their own request) */}
        {!isHost && hasPendingResetRequest ? (
          <div className="border-glass-border flex items-center gap-2 rounded-lg border bg-white/[0.03] px-3 py-2">
            <RotateCcw className="text-ink-muted size-3.5 shrink-0" aria-hidden />
            <p className="text-ink-muted text-caption flex-1">
              Reset request out. Waiting on {hostDisplayName} to call it.
            </p>
          </div>
        ) : null}

        {/* Hero — centered SVG ring with timer in the middle.
            References: Apple Fitness countdown ring + WHOOP's
            relaxation torus + Tiimo's serif Focus title. The ring
            stroke reveals clockwise from 12 o'clock as the timer
            elapses, with a glowing dot riding the leading edge.
            Dotted outer ring is pure ambient decoration — gives the
            hero a "field of attention" rather than a flat dial. */}
        <FocusRing
          progress={progress}
          phase={pomodoro.phase}
          paused={paused}
          time={time}
          round={pomodoro.round}
          totalRounds={pomodoro.totalRounds}
        />

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {isHost ? (
            <>
              <button
                type="button"
                onClick={() => fire({ action: paused ? 'resume' : 'pause' })}
                disabled={control.isPending}
                aria-label={paused ? 'Resume timer' : 'Pause timer'}
                className="bg-blurple hover:bg-blurple/90 text-blurple-foreground text-control inline-flex h-11 min-w-[130px] items-center justify-center gap-2 rounded-full px-5 font-semibold shadow-[0_0_24px_-6px_rgba(88,101,242,0.6)] transition-all disabled:opacity-60"
              >
                {paused ? <Play strokeWidth={2} size={18} /> : <Pause strokeWidth={2} size={18} />}
                <span>{paused ? 'Resume' : 'Pause'}</span>
              </button>
              <button
                type="button"
                onClick={() => fire({ action: 'skip' })}
                disabled={control.isPending}
                aria-label="Skip to next phase"
                className="border-glass-border text-ink-muted hover:text-ink hover:border-glass-border-strong inline-flex size-11 items-center justify-center rounded-full border transition-colors disabled:opacity-60"
              >
                <SkipForward strokeWidth={1.75} size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRequestReset}
              disabled={control.isPending || hasPendingResetRequest}
              className="text-ink-muted hover:text-ink hover:border-glass-border-strong border-glass-border text-control inline-flex h-10 items-center gap-1.5 rounded-full border px-4 transition-colors disabled:opacity-60"
            >
              <RotateCcw strokeWidth={1.75} size={14} />
              <span>{hasPendingResetRequest ? 'Reset pending' : 'Ask host to reset'}</span>
            </button>
          )}
        </div>

        {/* Live indicator row — Spaces/Clubhouse pattern. Pulsing
            dot + bold caps count + "LOCKED IN". Replaces the timid
            "1 person locked in" + the redundant "Whole room is
            cooking" footer. */}
        <div className="border-glass-border/60 mt-auto flex items-center justify-center gap-2 border-t pt-3">
          <span aria-hidden className="relative inline-flex size-2 shrink-0">
            <span
              className={cn(
                'absolute inset-0 rounded-full',
                isFocus ? 'bg-blurple' : 'bg-green-400',
              )}
            />
            <span
              className={cn(
                'absolute inset-0 animate-ping rounded-full opacity-60',
                isFocus ? 'bg-blurple' : 'bg-green-400',
              )}
            />
          </span>
          <span className="text-ink text-badge font-bold tracking-[0.18em] uppercase">
            {participantCount} locked in
          </span>
          <span className="text-ink-muted text-badge tracking-[0.18em] uppercase">
            · room is cooking
          </span>
        </div>

        {/* Vibe block — pure typography pull-quote. References:
            Open ("— DR. JAMES R HARRIS"), (Not Boring) Habits's
            confident centered copy. A blurple decorative bar on
            the left anchors the block as a unit; the tip rides
            below as an attribution-style caps line. No magic
            icons (CLAUDE.md reserves them for AI surfaces). */}
        <div className="relative pl-3">
          <span
            aria-hidden
            className="bg-blurple/60 absolute top-1 bottom-1 left-0 w-[2px] rounded-full"
          />
          <p className="text-ink text-control leading-snug italic">&ldquo;{quote}&rdquo;</p>
          <p className="text-ink-muted text-badge mt-1.5 tracking-[0.16em] uppercase">
            — tip · {tip}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function getRemainingMs(pomodoro: PomodoroSnapshot, nowMs: number): number {
  if (pomodoro.pausedRemainingMs !== null) return pomodoro.pausedRemainingMs;
  if (pomodoro.endsAt === null) return 0;
  return Math.max(0, new Date(pomodoro.endsAt).getTime() - nowMs);
}

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
