import { beforeEach, describe, expect, test } from 'vitest';

import { useIntegrationPrefs } from './integration-prefs-store';

const DEFAULTS = {
  prefs: {
    spotify: { showOnProfile: false, showAsStatus: true },
    google: { showOnProfile: false, showAsStatus: true },
  },
};

describe('integration-prefs-store', () => {
  beforeEach(() => {
    useIntegrationPrefs.setState(DEFAULTS);
  });

  test('defaults seed every known provider', () => {
    const { prefs } = useIntegrationPrefs.getState();
    expect(prefs.spotify).toEqual({ showOnProfile: false, showAsStatus: true });
    expect(prefs.google).toEqual({ showOnProfile: false, showAsStatus: true });
  });

  test('setShowOnProfile flips just that flag for the named provider', () => {
    useIntegrationPrefs.getState().setShowOnProfile('spotify', true);

    const { prefs } = useIntegrationPrefs.getState();
    expect(prefs.spotify.showOnProfile).toBe(true);
    expect(prefs.spotify.showAsStatus).toBe(true);
    // Other providers are untouched.
    expect(prefs.google.showOnProfile).toBe(false);
  });

  test('setShowAsStatus flips just that flag for the named provider', () => {
    useIntegrationPrefs.getState().setShowAsStatus('google', false);

    const { prefs } = useIntegrationPrefs.getState();
    expect(prefs.google.showAsStatus).toBe(false);
    expect(prefs.google.showOnProfile).toBe(false);
    expect(prefs.spotify.showAsStatus).toBe(true);
  });
});
