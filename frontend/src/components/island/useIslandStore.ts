import { create } from 'zustand';

export type IslandExpandedTarget = 'calendar' | 'pomodoro';

interface IslandStore {
  /**
   * Which surface the island is currently expanded to, or `null` if
   * the island is in its idle pill state. Multi-state instead of a
   * boolean so the same tap gesture can route to different expanded
   * shapes depending on what the pill is currently showing:
   *
   *   - tapping the date / next-event / event-soon pill → 'calendar'
   *     (opens the embedded `CalendarShell`).
   *   - tapping the pomodoro-tick pill → 'pomodoro' (opens the full
   *     pomodoro card with pause/skip/end controls).
   *
   * The personal-AI surface lives in its own floating capsule
   * (`AiCapsule`) alongside the music capsule, not as a route here.
   */
  expandedTo: IslandExpandedTarget | null;
  setExpandedTo: (target: IslandExpandedTarget | null) => void;
}

export const useIslandStore = create<IslandStore>((set) => ({
  expandedTo: null,
  setExpandedTo: (expandedTo) => set({ expandedTo }),
}));
