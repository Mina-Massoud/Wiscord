import { beforeEach, describe, expect, test } from 'vitest';

import { useAppearance } from './appearance-store';

describe('appearance-store', () => {
  beforeEach(() => {
    useAppearance.setState({ theme: 'dark', density: 'default' });
  });

  test('defaults to dark + default density', () => {
    const state = useAppearance.getState();
    expect(state.theme).toBe('dark');
    expect(state.density).toBe('default');
  });

  test('setTheme persists the new value', () => {
    useAppearance.getState().setTheme('light');
    expect(useAppearance.getState().theme).toBe('light');
    expect(useAppearance.getState().density).toBe('default');
  });

  test('setDensity persists the new value', () => {
    useAppearance.getState().setDensity('compact');
    expect(useAppearance.getState().density).toBe('compact');
    expect(useAppearance.getState().theme).toBe('dark');
  });
});
