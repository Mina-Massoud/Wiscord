import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { logger } from '@/lib/logger';
import {
  buildPresetCss,
  DEFAULT_PRESET_ID,
  findPreset,
  type ThemePresetId,
} from '@/lib/theme-presets';

const STYLE_ELEMENT_ID = 'wiscord-theme-preset';

interface ThemePresetState {
  presetId: ThemePresetId;
  setPreset: (id: ThemePresetId) => void;
}

// Bump `version` whenever the default preset changes — the migration resets
// any older persisted choice to the current default so the new default
// actually takes effect on the user's next reload. Once a user picks a
// preset from the picker, the new version is written and future default
// bumps won't override their explicit choice.
const PERSIST_VERSION = 3;

export const useThemePreset = create<ThemePresetState>()(
  persist(
    (set) => ({
      presetId: DEFAULT_PRESET_ID,
      setPreset: (presetId) => set({ presetId }),
    }),
    {
      name: 'wiscord.theme-preset',
      version: PERSIST_VERSION,
      migrate: (_persisted, fromVersion) => {
        if (fromVersion < PERSIST_VERSION) {
          return { presetId: DEFAULT_PRESET_ID } as ThemePresetState;
        }
        return _persisted as ThemePresetState;
      },
    },
  ),
);

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const element = document.createElement('style');
  element.id = STYLE_ELEMENT_ID;
  document.head.appendChild(element);
  return element;
}

/**
 * Mount once at the App root. Reflects the persisted preset onto a single
 * <style> tag in <head> so every preset switch re-skins the UI on the next
 * paint without any component re-render. The tag survives across navigations
 * and HMR — only the textContent changes.
 */
export function useApplyThemePreset(): void {
  const presetId = useThemePreset((s) => s.presetId);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      const preset = findPreset(presetId);
      const style = ensureStyleElement();
      style.textContent = buildPresetCss(preset);
    } catch (error) {
      logger.warn('theme-preset: failed to apply preset', error);
    }
  }, [presetId]);
}
