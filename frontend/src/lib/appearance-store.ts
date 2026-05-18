import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppearanceTheme = 'dark' | 'light' | 'system';
export type AppearanceDensity = 'compact' | 'default' | 'spacious';

interface AppearanceState {
  /** Theme preference. Wiscord is dark-only today; `light` and `system` are
   * intentionally surfaced but disabled in the UI until the light tokens
   * land. The store accepts them so a future theme switch is data-only. */
  theme: AppearanceTheme;
  density: AppearanceDensity;

  setTheme: (theme: AppearanceTheme) => void;
  setDensity: (density: AppearanceDensity) => void;
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      density: 'default',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
    }),
    { name: 'wiscord.appearance' },
  ),
);

/**
 * Reflects the persisted density onto `<html data-density="…">` so Tailwind
 * variants like `data-[density=compact]:` can react. Mount once at the App
 * root; calling more than once is harmless but redundant.
 */
export function useApplyAppearance(): void {
  const density = useAppearance((s) => s.density);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.density = density;
  }, [density]);
}
