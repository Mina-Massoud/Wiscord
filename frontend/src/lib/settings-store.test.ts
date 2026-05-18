import { beforeEach, describe, expect, test } from 'vitest';

import { useSettingsStore } from './settings-store';

describe('settings-store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ isOpen: false, activeTab: 'myAccount' });
  });

  test('starts closed on myAccount', () => {
    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.activeTab).toBe('myAccount');
  });

  test('open() flips isOpen without changing the tab', () => {
    useSettingsStore.setState({ activeTab: 'voice' });
    useSettingsStore.getState().open();
    expect(useSettingsStore.getState().isOpen).toBe(true);
    expect(useSettingsStore.getState().activeTab).toBe('voice');
  });

  test('open(tab) sets both flags atomically', () => {
    useSettingsStore.getState().open('appearance');
    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.activeTab).toBe('appearance');
  });

  test('close() flips isOpen without resetting the tab', () => {
    useSettingsStore.getState().open('voice');
    useSettingsStore.getState().close();
    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.activeTab).toBe('voice');
  });

  test('setTab() does not toggle isOpen', () => {
    useSettingsStore.getState().setTab('profiles');
    expect(useSettingsStore.getState().isOpen).toBe(false);
    expect(useSettingsStore.getState().activeTab).toBe('profiles');
  });
});
