import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Pomodoro timer state. Persisted so a tab refresh doesn't vaporize an
 * in-progress session. Hard-coded defaults for v1:
 *
 *  - focus phase: 25 minutes
 *  - break phase: 5 minutes
 *  - cycle: 4 rounds, then auto-end
 *
 * `endsAt` is a wall-clock timestamp so we can compute remaining ms
 * cheaply with `Date.now() - endsAt`. `pausedRemainingMs` snapshots
 * the gap when paused; resume re-anchors `endsAt`.
 *
 * Stale-on-resume: if a persisted session has `endsAt` in the past
 * by more than a single phase length, we treat it as ended on load
 * (the user closed the tab and didn't come back in time). Less
 * confusing than reviving a "you have 0 minutes left" pill.
 *
 * Daily history: `sessionsCompletedToday` + `minutesFocusedToday`
 * track completed focus phases. Both auto-reset when the persisted
 * `lastSessionDate` falls out of today.
 */

export type PomodoroPhase = 'focus' | 'break';

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const DEFAULT_ROUNDS = 4;

function phaseSeconds(phase: PomodoroPhase): number {
  return phase === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

interface PomodoroPersisted {
  phase: PomodoroPhase | null;
  round: number;
  totalRounds: number;
  endsAt: number | null;
  pausedRemainingMs: number | null;
  /** YYYY-MM-DD of the most recent completed focus session. Used to
   *  decide whether to roll the daily counters. */
  lastSessionDate: string | null;
  sessionsCompletedToday: number;
  minutesFocusedToday: number;
  /** Total consecutive days (including today) with ≥1 completed focus
   *  session. Renews on the first completion of a new day. */
  streakDays: number;
}

interface PomodoroState extends PomodoroPersisted {
  start: (phase?: PomodoroPhase) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  end: () => void;
  addFiveMinutes: () => void;
}

const INITIAL: PomodoroPersisted = {
  phase: null,
  round: 0,
  totalRounds: DEFAULT_ROUNDS,
  endsAt: null,
  pausedRemainingMs: null,
  lastSessionDate: null,
  sessionsCompletedToday: 0,
  minutesFocusedToday: 0,
  streakDays: 0,
};

/** Increment daily stats by one completed focus session. Rolls
 *  yesterday → today and computes streak continuation. */
function completeFocusSession(state: PomodoroPersisted): Partial<PomodoroPersisted> {
  const today = todayIso();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  })();

  if (state.lastSessionDate !== today) {
    // First completion of a new day. If yesterday had a session, streak
    // continues; otherwise it resets to 1.
    const continuing = state.lastSessionDate === yesterday;
    return {
      lastSessionDate: today,
      sessionsCompletedToday: 1,
      minutesFocusedToday: Math.round(FOCUS_SECONDS / 60),
      streakDays: continuing ? state.streakDays + 1 : 1,
    };
  }
  return {
    sessionsCompletedToday: state.sessionsCompletedToday + 1,
    minutesFocusedToday: state.minutesFocusedToday + Math.round(FOCUS_SECONDS / 60),
  };
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      start: (phase: PomodoroPhase = 'focus') => {
        const total = phaseSeconds(phase);
        set((state) => ({
          phase,
          round: state.round === 0 ? 1 : state.round,
          endsAt: Date.now() + total * 1000,
          pausedRemainingMs: null,
        }));
      },

      pause: () => {
        const { endsAt } = get();
        if (!endsAt) return;
        set({ pausedRemainingMs: Math.max(0, endsAt - Date.now()), endsAt: null });
      },

      resume: () => {
        const { pausedRemainingMs } = get();
        if (pausedRemainingMs === null) return;
        set({ endsAt: Date.now() + pausedRemainingMs, pausedRemainingMs: null });
      },

      skip: () => {
        const state = get();
        const { phase, round, totalRounds } = state;
        if (!phase) return;
        if (phase === 'focus') {
          // Skipping out of focus = "session completed" (the user
          // either rode the clock to 0 or chose to bank what they did).
          set({
            ...completeFocusSession(state),
            phase: 'break',
            endsAt: Date.now() + BREAK_SECONDS * 1000,
            pausedRemainingMs: null,
          });
        } else if (round >= totalRounds) {
          set({ ...INITIAL, ...preserveStats(state) });
        } else {
          set({
            phase: 'focus',
            round: round + 1,
            endsAt: Date.now() + FOCUS_SECONDS * 1000,
            pausedRemainingMs: null,
          });
        }
      },

      end: () => set((state) => ({ ...INITIAL, ...preserveStats(state) })),

      addFiveMinutes: () => {
        const { endsAt, pausedRemainingMs } = get();
        if (endsAt !== null) set({ endsAt: endsAt + 5 * 60_000 });
        else if (pausedRemainingMs !== null)
          set({ pausedRemainingMs: pausedRemainingMs + 5 * 60_000 });
      },
    }),
    {
      name: 'wiscord.island.pomodoro',
      version: 2,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Stale-on-resume: drop dead timers we slept through.
        const { phase, endsAt } = state;
        if (phase && endsAt !== null) {
          const overdueMs = Date.now() - endsAt;
          const onePhaseMs = phaseSeconds(phase) * 1000;
          if (overdueMs > onePhaseMs) {
            state.phase = null;
            state.round = 0;
            state.endsAt = null;
            state.pausedRemainingMs = null;
          }
        }
        // Daily roll: if the last completion was on a previous day,
        // zero today's counters. Streak is preserved (so a single
        // skipped day breaks it the *next* completion, not now).
        if (state.lastSessionDate && state.lastSessionDate !== todayIso()) {
          state.sessionsCompletedToday = 0;
          state.minutesFocusedToday = 0;
        }
      },
      migrate: (persisted, fromVersion) => {
        // v1 → v2: introduces daily stats fields. Existing users start
        // at zero — no historical data to backfill.
        if (fromVersion < 2) {
          return {
            ...INITIAL,
            ...(persisted as Partial<PomodoroPersisted>),
            lastSessionDate: null,
            sessionsCompletedToday: 0,
            minutesFocusedToday: 0,
            streakDays: 0,
          };
        }
        return persisted as PomodoroPersisted;
      },
    },
  ),
);

/** Keep the daily/streak counters when resetting timer state. */
function preserveStats(state: PomodoroPersisted): Partial<PomodoroPersisted> {
  return {
    lastSessionDate: state.lastSessionDate,
    sessionsCompletedToday: state.sessionsCompletedToday,
    minutesFocusedToday: state.minutesFocusedToday,
    streakDays: state.streakDays,
  };
}

/** Remaining ms helper — pure, no React. Accepts the full persisted
 *  shape (or a structural subset) for caller convenience. */
export function getPomodoroRemainingMs(
  state: Pick<PomodoroPersisted, 'phase' | 'endsAt' | 'pausedRemainingMs'> & {
    round?: number;
    totalRounds?: number;
  },
  now = Date.now(),
): number {
  if (state.phase === null) return 0;
  if (state.pausedRemainingMs !== null) return state.pausedRemainingMs;
  if (state.endsAt === null) return 0;
  return Math.max(0, state.endsAt - now);
}

export function getPomodoroTotalSeconds(phase: PomodoroPhase): number {
  return phaseSeconds(phase);
}
