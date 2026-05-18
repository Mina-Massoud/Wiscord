import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Local-only preferences for the Dynamic Island, persisted to
 * localStorage under `wiscord.island.preferences`. Versioned so a
 * future shape change can migrate cleanly without wiping user prefs.
 *
 * `widgets` decides which auto-priority states the island is allowed
 * to take over. Disabling a widget doesn't break the island — it just
 * keeps that widget from grabbing the pill (e.g. `pomodoro: false`
 * means a running timer stays in the store but the island ignores it
 * for the pill).
 *
 * `idleWidget` is the resting-state shape the user *prefers* when no
 * higher-priority signal is active. Auto-priority (voice live, event
 * imminent, pomodoro running) still overrides this.
 */

export type IslandIdleWidget = 'date' | 'next-event';

export interface IslandPreferences {
  version: 2;
  idleWidget: IslandIdleWidget;
  widgets: {
    calendar: boolean;
    pomodoro: boolean;
    voice: boolean;
  };
}

const DEFAULT_PREFERENCES: IslandPreferences = {
  version: 2,
  idleWidget: 'date',
  widgets: { calendar: true, pomodoro: true, voice: true },
};

interface IslandPreferencesStore {
  preferences: IslandPreferences;
  setWidgetEnabled: (widget: keyof IslandPreferences['widgets'], enabled: boolean) => void;
  setIdleWidget: (idleWidget: IslandIdleWidget) => void;
  reset: () => void;
}

export const useIslandPreferences = create<IslandPreferencesStore>()(
  persist(
    (set) => ({
      preferences: DEFAULT_PREFERENCES,
      setWidgetEnabled: (widget, enabled) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            widgets: { ...state.preferences.widgets, [widget]: enabled },
          },
        })),
      setIdleWidget: (idleWidget) =>
        set((state) => ({
          preferences: { ...state.preferences, idleWidget },
        })),
      reset: () => set({ preferences: DEFAULT_PREFERENCES }),
    }),
    {
      name: 'wiscord.island.preferences',
      version: 2,
      // Forward-compatible migration. v1 had no `idleWidget` and no
      // `voice` widget; both default to safe values here.
      migrate: (persisted) => {
        const p = persisted as Partial<IslandPreferencesStore> | undefined;
        const prev = p?.preferences as Partial<IslandPreferences> | undefined;
        return {
          preferences: {
            ...DEFAULT_PREFERENCES,
            ...(prev ?? {}),
            widgets: {
              ...DEFAULT_PREFERENCES.widgets,
              ...(prev?.widgets ?? {}),
            },
          },
        } as IslandPreferencesStore;
      },
    },
  ),
);
