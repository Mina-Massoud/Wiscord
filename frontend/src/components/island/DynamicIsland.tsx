import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { useCalendarEvents } from '@/queries/calendar';
import { useVoiceActivity } from '@/queries/voice-activity';
import { useConnectedChannelId, useMyActivityKind } from '@/lib/voice-session-store';
import { cn } from '@/lib/cn';
import type { CalendarEvent } from '@/types/calendar';
import type { PomodoroSnapshot } from '@/queries/client';

import {
  ISLAND_BACKDROP_FADE,
  ISLAND_CONTENT_VARIANTS,
  ISLAND_SHAPE_STYLE,
  ISLAND_SHELL_SPRING,
} from './animations';
import type { IslandShape } from './islandShapes';
import { ISLAND_SHAPES } from './islandShapes';
import { IslandEventView } from './IslandEventView';
import { IslandExpandedView } from './IslandExpandedView';
import { IslandIdleView } from './IslandIdleView';
import { IslandPomodoroIdle, IslandPomodoroView } from './IslandPomodoroView';
import { useIslandPreferences } from './useIslandPreferences';
import { useIslandStore } from './useIslandStore';
import { getPomodoroRemainingMs, usePomodoroStore } from './usePomodoroStore';

/**
 * Dynamic Island — a single morphing shape mounted at the document
 * root via a portal. Six "options" the island routes today (calendar
 * + pomodoro + idle widget), each with its own shape spec:
 *
 *   - `date`           → idle pill, today's date + event-count dot
 *   - `next-event`     → idle wide pill, dot + title + time (when
 *                        the user has picked next-event as their
 *                        preferred idle widget AND an event exists
 *                        today, but isn't imminent)
 *   - `pomodoro-tick`  → minimal pill with mm:ss countdown
 *   - `event-soon`     → compact card with imminent event (≤15 min)
 *   - `pomodoro-card`  → compact card with full timer controls
 *                        (entered by tapping the pomodoro-tick pill)
 *   - `expanded`       → full embedded `CalendarShell` sheet
 *                        (entered by tapping any non-pomodoro pill)
 *
 * Priority: `expanded > pomodoro-card > event-soon > pomodoro-tick
 *           > preferred-idle-widget > date`.
 *
 * Click routing is mode-aware: tapping a pomodoro pill expands to
 * the pomodoro card; tapping anything else expands to the calendar.
 * The store tracks `expandedTo: 'calendar' | 'pomodoro' | null`.
 *
 * Reserved for v3 (settings shows "Soon" chip):
 *   - Voice live (mic + room presence). Blocked on lifting LiveKit
 *     room context to the app shell; today the room only mounts on
 *     `/app/labs/voice`, so a global "voice connected" state doesn't
 *     yet exist.
 *
 * Shape comes from `ISLAND_SHAPES[mode]` as inline `width`/`height`
 * so framer-motion's `layout` engine can interpolate between tiers
 * with a single spring. Content choreography lives in
 * `ISLAND_CONTENT_VARIANTS` — old content fades out before the shape
 * morph completes, new content fades in after, so the user never sees
 * a giant card squished into a pill.
 *
 * Background is a solid jet-black surface + hairline border + tight
 * shadow — matches every Mobbin reference (Forest, Opal, Apple Fitness,
 * Flighty, Tinder).
 */
export function DynamicIsland(): React.JSX.Element | null {
  const expandedTo = useIslandStore((s) => s.expandedTo);
  const setExpandedTo = useIslandStore((s) => s.setExpandedTo);
  const reducedMotion = useReducedMotion();

  const widgets = useIslandPreferences((s) => s.preferences.widgets);
  const idleWidget = useIslandPreferences((s) => s.preferences.idleWidget);

  const pomodoroPhase = usePomodoroStore((s) => s.phase);
  const pomodoroRound = usePomodoroStore((s) => s.round);
  const pomodoroTotalRounds = usePomodoroStore((s) => s.totalRounds);
  const pomodoroEndsAt = usePomodoroStore((s) => s.endsAt);
  const pomodoroPausedMs = usePomodoroStore((s) => s.pausedRemainingMs);
  const pomodoroSessionsToday = usePomodoroStore((s) => s.sessionsCompletedToday);
  const pomodoroMinutesToday = usePomodoroStore((s) => s.minutesFocusedToday);
  const pomodoroStreakDays = usePomodoroStore((s) => s.streakDays);
  const pomodoroPause = usePomodoroStore((s) => s.pause);
  const pomodoroResume = usePomodoroStore((s) => s.resume);
  const pomodoroSkip = usePomodoroStore((s) => s.skip);
  const pomodoroEnd = usePomodoroStore((s) => s.end);

  const pomodoroActive = pomodoroPhase !== null && widgets.pomodoro;

  // Shared-pomodoro pickup: only surface the synced timer in the
  // island when the local user has *explicitly opted in* to the
  // session (i.e. they picked the pomodoro activity from the voice
  // card or activity launcher). Just being in a voice channel where
  // someone else is running a pomodoro isn't enough — we don't want
  // to auto-broadcast someone else's focus state to a passerby who
  // dropped in for an unrelated reason.
  //
  // Concretely: the local user's `myActivityKind === 'pomodoro'` is
  // the join signal; the server doc's `kind === 'pomodoro'` confirms
  // the session exists. Both are required.
  const connectedChannelId = useConnectedChannelId();
  const myActivityKind = useMyActivityKind();
  const voiceActivity = useVoiceActivity(connectedChannelId ?? undefined);
  const sharedPomodoro: PomodoroSnapshot | null =
    myActivityKind === 'pomodoro' && voiceActivity.data?.kind === 'pomodoro'
      ? voiceActivity.data.pomodoro
      : null;
  const sharedPomodoroActive = sharedPomodoro !== null;

  // 1s tick while *any* pomodoro is running (solo OR shared) so the
  // mm:ss countdown stays accurate; 30s otherwise.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const intervalMs = pomodoroActive || sharedPomodoroActive ? 1_000 : 30_000;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [pomodoroActive, sharedPomodoroActive]);

  // Pill-state event peek (7-day window, shares the react-query cache
  // with the embedded `CalendarShell`).
  const range = useMemo(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const events = useCalendarEvents({ channelId: null, ...range });
  const all = events.data ?? [];

  const next = useMemo<CalendarEvent | null>(() => {
    if (!widgets.calendar) return null;
    return (
      all
        .filter((e) => new Date(e.startAt).getTime() > now - 60_000)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null
    );
  }, [all, now, widgets.calendar]);

  const minutesAway = next ? Math.round((new Date(next.startAt).getTime() - now) / 60_000) : null;

  const pomodoroRemainingMs = getPomodoroRemainingMs(
    {
      phase: pomodoroPhase,
      endsAt: pomodoroEndsAt,
      pausedRemainingMs: pomodoroPausedMs,
      round: pomodoroRound,
      totalRounds: pomodoroTotalRounds,
    },
    now,
  );

  const mode = deriveMode({
    expandedTo,
    minutesAway,
    pomodoroActive,
    sharedPomodoroActive,
    idleWidget: next ? idleWidget : 'date',
  });

  // Shape is keyed directly off `mode`. We used to lag it via a
  // `renderedMode` state synced on `onExitComplete`, paired with an
  // absolutely-positioned fixed-size Slot — that combo was a hangover
  // from the `layout`-prop era and created a "void corner" mid-morph
  // when shrinking to a smaller target. With `animate={{ width,
  // height }}` driving the shell (no transform-scale) and a stretchy
  // Slot, the shell + content collapse together cleanly without
  // either trick.
  const shape = ISLAND_SHAPES[mode];

  const today = new Date(now);
  const todayIso = isoDay(today);
  const todayCount = useMemo(
    () => all.filter((e) => isoDay(new Date(e.startAt)) === todayIso).length,
    [all, todayIso],
  );

  const expanded = expandedTo !== null;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setExpandedTo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, setExpandedTo]);

  // Auto-close on route change so the island doesn't hang over a new
  // page when the user navigates from inside the embedded calendar.
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      if (expanded) setExpandedTo(null);
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, expanded, setExpandedTo]);

  // Auto-retract the pomodoro card when the underlying timer ends
  // (user hit "End" or the cycle wrapped to null). Without this the
  // card stays open with an empty payload until the user dismisses.
  //
  // Important: "underlying timer" means EITHER the local solo timer
  // OR the shared session the user has opted into. Without checking
  // both, expanding to the shared card immediately bounces closed
  // (the local phase is null while a shared session is active).
  useEffect(() => {
    if (expandedTo === 'pomodoro' && !pomodoroPhase && !sharedPomodoroActive) {
      setExpandedTo(null);
    }
  }, [expandedTo, pomodoroPhase, sharedPomodoroActive, setExpandedTo]);

  if (typeof document === 'undefined') return null;

  // Mode-aware click routing: tapping the pomodoro tick (solo OR
  // shared) opens the pomodoro card; tapping anything else opens the
  // calendar sheet. Already-expanded states ignore taps on the shell
  // — the backdrop handles dismiss.
  const onShellClick = expanded
    ? undefined
    : (): void => setExpandedTo(mode === 'pomodoro-tick' ? 'pomodoro' : 'calendar');

  return createPortal(
    <>
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="island-backdrop"
            variants={ISLAND_BACKDROP_FADE}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => setExpandedTo(null)}
            className="fixed inset-0 z-50 backdrop-blur-md"
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        data-island-shell
        role={expanded ? 'dialog' : 'button'}
        aria-haspopup={expanded ? undefined : 'dialog'}
        aria-expanded={expanded}
        aria-label={
          expandedTo === 'pomodoro'
            ? 'Pomodoro timer'
            : expandedTo === 'calendar'
              ? 'Calendar island'
              : 'Open dynamic island'
        }
        tabIndex={expanded ? -1 : 0}
        onClick={onShellClick}
        onKeyDown={
          expanded
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedTo(mode === 'pomodoro-tick' ? 'pomodoro' : 'calendar');
                }
              }
        }
        // Width/height are animated via the `animate` prop (not `layout`)
        // because `layout` uses `transform: scale()` under the hood to
        // morph size, which visually scales the children too — that
        // produced the "giant 15 MAY content during collapse" frame.
        // Animating width/height directly resizes the box without any
        // scale transform, so children render at their natural size.
        initial={false}
        animate={{ width: shape.width, height: shape.height }}
        style={{
          ...ISLAND_SHAPE_STYLE,
          backgroundColor: '#0A0A0C',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06) inset, 0 12px 32px -8px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.5)',
        }}
        transition={reducedMotion ? { duration: 0 } : ISLAND_SHELL_SPRING}
        className={cn(
          'fixed top-[3px] right-20',
          // Idle pill stays low (z-30) so unrelated dialogs / dropdowns
          // (z-50 shadcn default) overlay it correctly. Expanded shell
          // jumps to z-50 to join the floating UI layer; DOM mount
          // order resolves stacking against anything spawned from
          // inside (gear popover, quick-add popover, full Dialog,
          // Select dropdowns, drag ghost) — those all mount AFTER the
          // shell, so they end up on top without per-instance bumps.
          expanded ? 'z-50' : 'z-30',
          'text-ink',
          'overflow-hidden',
          shape.radiusClass,
          !expanded && 'cursor-pointer',
          'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'date' ? (
            <Slot key="date" shape={ISLAND_SHAPES.date}>
              <IslandIdleView
                day={today.getDate()}
                month={today.toLocaleDateString(undefined, { month: 'short' })}
                todayCount={todayCount}
              />
            </Slot>
          ) : null}

          {mode === 'next-event' && next ? (
            <Slot key="next-event" shape={ISLAND_SHAPES['next-event']}>
              <NextEventPill event={next} />
            </Slot>
          ) : null}

          {mode === 'pomodoro-tick' && sharedPomodoro ? (
            <Slot key="pomodoro-tick-shared" shape={ISLAND_SHAPES['pomodoro-tick']}>
              <IslandPomodoroIdle
                phase={sharedPomodoro.phase}
                remainingMs={getSharedRemainingMs(sharedPomodoro, now)}
                paused={sharedPomodoro.endsAt === null && sharedPomodoro.pausedRemainingMs !== null}
              />
            </Slot>
          ) : mode === 'pomodoro-tick' && pomodoroPhase ? (
            <Slot key="pomodoro-tick" shape={ISLAND_SHAPES['pomodoro-tick']}>
              <IslandPomodoroIdle
                phase={pomodoroPhase}
                remainingMs={pomodoroRemainingMs}
                paused={pomodoroEndsAt === null && pomodoroPausedMs !== null}
              />
            </Slot>
          ) : null}

          {mode === 'event-soon' && next && minutesAway !== null ? (
            <Slot key="event-soon" shape={ISLAND_SHAPES['event-soon']}>
              <IslandEventView event={next} minutesAway={minutesAway} />
            </Slot>
          ) : null}

          {mode === 'pomodoro-card' && sharedPomodoro ? (
            <Slot key="pomodoro-card-shared" shape={ISLAND_SHAPES['pomodoro-card']}>
              <SharedPomodoroCard
                pomodoro={sharedPomodoro}
                nowMs={now}
                onClose={() => setExpandedTo(null)}
              />
            </Slot>
          ) : mode === 'pomodoro-card' && pomodoroPhase ? (
            <Slot key="pomodoro-card" shape={ISLAND_SHAPES['pomodoro-card']}>
              <IslandPomodoroView
                phase={pomodoroPhase}
                round={pomodoroRound}
                totalRounds={pomodoroTotalRounds}
                remainingMs={pomodoroRemainingMs}
                paused={pomodoroEndsAt === null && pomodoroPausedMs !== null}
                sessionsCompletedToday={pomodoroSessionsToday}
                minutesFocusedToday={pomodoroMinutesToday}
                streakDays={pomodoroStreakDays}
                nowMs={now}
                onPause={pomodoroPause}
                onResume={pomodoroResume}
                onSkip={pomodoroSkip}
                onEnd={pomodoroEnd}
              />
            </Slot>
          ) : null}

          {mode === 'expanded' ? (
            <Slot key="expanded" shape={ISLAND_SHAPES.expanded}>
              <IslandExpandedView now={now} onClose={() => setExpandedTo(null)} />
            </Slot>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </>,
    document.body,
  );
}

/**
 * Fixed-dimension content slot. Each option is mounted inside its own
 * Slot, which pins its size to `ISLAND_SHAPES[mode]` regardless of
 * what the parent shell is currently morphing through. Anchored
 * top-right so the content sits exactly where the *target* pill will
 * end up — combined with `overflow: hidden` on the shell, this kills
 * the "small-pill content rendered at expanded-card dimensions" bug
 * you'd otherwise see during the morph.
 *
 * Owns the content fade variants so the views themselves stay plain
 * markup. Padding lives here too (per-shape).
 */
interface SlotProps {
  shape: IslandShape;
  children: React.ReactNode;
}

function Slot({ shape, children }: SlotProps): React.JSX.Element {
  // Slot fills the shell (h-full w-full) instead of pinning to a fixed
  // target size. With `mode="wait"` only ONE Slot renders at a time,
  // so it can safely stretch to the current shell dimensions. The
  // shell itself animates width/height via `animate` (NOT `layout`),
  // so children get their natural sizing — no transform-scale, no
  // squish frame, no void corner during a big-to-small morph.
  //
  // Padding lives here per-shape so the content insets shrink with
  // the shell during a collapse instead of jumping at exit-complete.
  return (
    <motion.div
      variants={ISLAND_CONTENT_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-full w-full"
      style={{
        paddingInline: shape.paddingX,
        paddingBlock: shape.paddingY,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Compact next-event pill (240 × 26) used when the user has picked
 * `next-event` as their idle widget AND there's an event today that
 * isn't imminent (>15 min). When it crosses the 15-min threshold, the
 * shape upgrades to `event-soon` (340 × 72) via the layout morph.
 */
function NextEventPill({ event }: { event: CalendarEvent }): React.JSX.Element {
  const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="flex h-full w-full items-center">
      <span aria-hidden className="bg-blurple size-1.5 shrink-0 rounded-full" />
      <span className="text-ink text-badge ml-2 min-w-0 flex-1 truncate font-semibold">
        {event.title}
      </span>
      <span className="text-ink-muted text-badge ml-2 shrink-0 tabular-nums">
        {fmt.format(new Date(event.startAt))}
      </span>
    </div>
  );
}

export type IslandMode =
  | 'date'
  | 'next-event'
  | 'pomodoro-tick'
  | 'event-soon'
  | 'pomodoro-card'
  | 'expanded';

interface DeriveModeInput {
  /** Which surface the island is currently expanded to, or null. */
  expandedTo: 'calendar' | 'pomodoro' | null;
  minutesAway: number | null;
  pomodoroActive: boolean;
  /** True when the user's voice channel has a running pomodoro
   *  activity. Takes priority over the solo `pomodoroActive` flag
   *  because being part of a shared focus session is the more
   *  social/visible state — solo continues to tick locally but is
   *  shadowed in the island UI while the group is active. */
  sharedPomodoroActive: boolean;
  /** Preferred idle widget when no auto-priority signal wins. */
  idleWidget: 'date' | 'next-event';
}

/**
 * Pure mode derivation. Priority:
 *
 *   expandedTo='calendar'  → 'expanded'        (calendar sheet)
 *   expandedTo='pomodoro'  → 'pomodoro-card'   (timer card with controls)
 *   imminent event         → 'event-soon'      (≤15 min away)
 *   shared pomodoro        → 'pomodoro-tick'   (voice-channel session)
 *   solo pomodoro          → 'pomodoro-tick'   (local store)
 *   idle widget pref       → 'next-event' | 'date'
 *
 * Note: when expanded, the user already committed to a surface and we
 * never auto-flip out from under them — even if a calendar event
 * becomes imminent while the pomodoro card is open, we keep showing
 * the pomodoro card. The auto-takeover only happens from idle states.
 */
export function deriveMode({
  expandedTo,
  minutesAway,
  pomodoroActive,
  sharedPomodoroActive,
  idleWidget,
}: DeriveModeInput): IslandMode {
  if (expandedTo === 'calendar') return 'expanded';
  if (expandedTo === 'pomodoro') return 'pomodoro-card';
  if (minutesAway !== null && minutesAway <= 15) return 'event-soon';
  // Shared pomodoro outranks solo — the user is in a synchronised
  // session with other people, that's what we want surfaced.
  if (sharedPomodoroActive) return 'pomodoro-tick';
  if (pomodoroActive) return 'pomodoro-tick';
  if (idleWidget === 'next-event') return 'next-event';
  return 'date';
}

/** Compute remaining ms for a shared pomodoro snapshot. Mirrors the
 *  helper in `usePomodoroStore` but reads from the server snapshot
 *  shape — pure, no React. */
function getSharedRemainingMs(pomodoro: PomodoroSnapshot, nowMs: number): number {
  if (pomodoro.pausedRemainingMs !== null) return pomodoro.pausedRemainingMs;
  if (pomodoro.endsAt === null) return 0;
  return Math.max(0, new Date(pomodoro.endsAt).getTime() - nowMs);
}

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
function SharedPomodoroCard({
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

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
