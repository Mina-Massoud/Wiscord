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

import { ISLAND_BACKDROP_FADE, ISLAND_SHAPE_STYLE, ISLAND_SHELL_SPRING } from './animations';
import { ISLAND_SHAPES } from './islandShapes';
import { IslandEventView } from './IslandEventView';
import { IslandExpandedView } from './IslandExpandedView';
import { IslandIdleView } from './IslandIdleView';
import { IslandPomodoroIdle, IslandPomodoroView } from './IslandPomodoroView';
import { useIslandPreferences } from './useIslandPreferences';
import { useIslandStore } from './useIslandStore';
import { getPomodoroRemainingMs, usePomodoroStore } from './usePomodoroStore';
import { Slot } from './DynamicIslandSlot';
import { NextEventPill } from './DynamicIslandNextEventPill';
import { SharedPomodoroCard } from './DynamicIslandSharedPomodoroCard';

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
export function getSharedRemainingMs(pomodoro: PomodoroSnapshot, nowMs: number): number {
  if (pomodoro.pausedRemainingMs !== null) return pomodoro.pausedRemainingMs;
  if (pomodoro.endsAt === null) return 0;
  return Math.max(0, new Date(pomodoro.endsAt).getTime() - nowMs);
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
