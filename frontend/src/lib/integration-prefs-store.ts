import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '@/types/integration';

interface ProviderPrefs {
  /** Surfaces the connected account on the public profile card. Visual-only
   *  today — profile-card rendering will read this when it ships. */
  showOnProfile: boolean;
  /** Replaces user status with "Listening to …" when there's a now-playing
   *  track. Visual-only today — presence consumer will read this later. */
  showAsStatus: boolean;
}

type PrefsByProvider = Record<IntegrationProvider, ProviderPrefs>;

interface IntegrationPrefsState {
  prefs: PrefsByProvider;
  setShowOnProfile: (provider: IntegrationProvider, value: boolean) => void;
  setShowAsStatus: (provider: IntegrationProvider, value: boolean) => void;
}

const DEFAULT_PREFS: ProviderPrefs = {
  showOnProfile: false,
  showAsStatus: true,
};

function buildDefaults(): PrefsByProvider {
  return INTEGRATION_PROVIDERS.reduce<PrefsByProvider>((acc, provider) => {
    acc[provider] = { ...DEFAULT_PREFS };
    return acc;
  }, {} as PrefsByProvider);
}

export const useIntegrationPrefs = create<IntegrationPrefsState>()(
  persist(
    (set) => ({
      prefs: buildDefaults(),
      setShowOnProfile: (provider, value) =>
        set((state) => ({
          prefs: {
            ...state.prefs,
            [provider]: { ...(state.prefs[provider] ?? DEFAULT_PREFS), showOnProfile: value },
          },
        })),
      setShowAsStatus: (provider, value) =>
        set((state) => ({
          prefs: {
            ...state.prefs,
            [provider]: { ...(state.prefs[provider] ?? DEFAULT_PREFS), showAsStatus: value },
          },
        })),
    }),
    {
      name: 'wiscord.integration-prefs',
      // Old persisted state may be missing a newer provider — fill gaps so
      // selectors never see `undefined`.
      merge: (persisted, current) => {
        const next: IntegrationPrefsState = { ...current, ...(persisted as IntegrationPrefsState) };
        const merged: PrefsByProvider = { ...buildDefaults(), ...(next.prefs ?? {}) };
        return { ...next, prefs: merged };
      },
    },
  ),
);
