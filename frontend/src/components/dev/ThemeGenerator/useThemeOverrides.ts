import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';

import { buildOverrideCss, type ThemeOverrides } from './theme-css-emitter';

const STORAGE_KEY = 'wiscord_theme_overrides';
const STYLE_ELEMENT_ID = 'wiscord-theme-overrides';
const PERSIST_DEBOUNCE_MS = 150;

function readFromStorage(): ThemeOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return {};
    const result: ThemeOverrides = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') result[key] = value;
    }
    return result;
  } catch (error) {
    logger.warn('theme-overrides: failed to parse localStorage entry', error);
    return {};
  }
}

function ensureStyleElement(): HTMLStyleElement {
  let element = document.getElementById(STYLE_ELEMENT_ID);
  if (element instanceof HTMLStyleElement) return element;
  element = document.createElement('style');
  element.id = STYLE_ELEMENT_ID;
  document.head.appendChild(element);
  return element as HTMLStyleElement;
}

function removeStyleElement(): void {
  const element = document.getElementById(STYLE_ELEMENT_ID);
  if (element !== null) element.remove();
}

export interface UseThemeOverridesResult {
  overrides: ThemeOverrides;
  setOverride: (id: string, value: string) => void;
  resetToken: (id: string) => void;
  resetAll: () => void;
  isOverridden: (id: string) => boolean;
}

export function useThemeOverrides(): UseThemeOverridesResult {
  const [overrides, setOverrides] = useState<ThemeOverrides>(() => readFromStorage());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply CSS overrides whenever the map changes; persist (debounced) to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const css = buildOverrideCss(overrides);
    if (css === '') {
      removeStyleElement();
    } else {
      const style = ensureStyleElement();
      style.textContent = css;
    }

    if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch (error) {
        logger.warn('theme-overrides: failed to persist to localStorage', error);
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimer.current !== null) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
    };
  }, [overrides]);

  // Clean up the style tag if the consumer unmounts (e.g. HMR).
  useEffect(() => {
    return () => removeStyleElement();
  }, []);

  const setOverride = useCallback((id: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [id]: value }));
  }, []);

  const resetToken = useCallback((id: string) => {
    setOverrides((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
  }, []);

  const isOverridden = useCallback(
    (id: string) => overrides[id] !== undefined && overrides[id] !== '',
    [overrides],
  );

  return { overrides, setOverride, resetToken, resetAll, isOverridden };
}
