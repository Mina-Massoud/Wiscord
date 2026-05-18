import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { toast } from '@/lib/toast';
import { useSettingsStore } from '@/lib/settings-store';
import { qk } from '@/queries/keys';

/**
 * Watches for the integrations OAuth round-trip landing — the backend
 * callback redirects to `/app?settings=integrations&connected=<provider>`
 * on success or `&error=<code>` on failure.
 *
 * Mounted at the App root inside the authed scope so the dialog opens to
 * the Integrations tab and the toast fires *whether or not* the user had
 * Settings open when they clicked Connect. Doing this in the panel itself
 * silently fails because the panel never mounts when the dialog is closed.
 */
const PROVIDER_NAMES: Record<string, string> = {
  spotify: 'Spotify',
  google: 'YouTube Music',
};

const ERROR_COPY: Record<string, string> = {
  integration_not_configured: "We haven't set that one up yet. Try the other one for now.",
  oauth_bad_state: 'That sign-in took too long. Hit Connect again.',
  oauth_provider_mismatch: 'That sign-in took too long. Hit Connect again.',
  oauth_exchange_failed: "Couldn't finish the connection. Try once more?",
  oauth_identity_failed: "Couldn't finish the connection. Try once more?",
  // Spotify-specific: the *app owner* (the dev account that registered
  // the app) needs Premium before any Web API call is allowed.
  oauth_provider_premium_required:
    'Spotify wants the app owner on Premium before this works. Heads up to the team.',
  // Spotify dev-mode quirk — only test-listed users can sign in.
  oauth_provider_user_not_allowed:
    "You're not on the test-user list yet. Ping the team to add your Spotify account.",
  access_denied: 'No worries — you cancelled the sign-in.',
};

export function IntegrationsReturnHandler(): null {
  const location = useLocation();
  const navigate = useNavigate();
  const open = useSettingsStore((s) => s.open);
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const settings = params.get('settings');
    const connected = params.get('connected');
    const oauthErr = params.get('error');

    // Only fire when the URL is unambiguously a return from the integrations
    // OAuth flow — not on any random ?error= param.
    if (settings !== 'integrations' || (!connected && !oauthErr)) return;

    // Pop the dialog to the Integrations tab so the user sees the new state.
    open('integrations');

    if (connected) {
      const name = PROVIDER_NAMES[connected] ?? connected;
      toast.success(`${name} is in. 🎧`);
      void qc.invalidateQueries({ queryKey: qk.integrations.all() });
    } else if (oauthErr) {
      const msg = ERROR_COPY[oauthErr] ?? 'Something went sideways. Try connecting again.';
      toast.error(msg);
    }

    // Scrub so a refresh doesn't re-fire the toast or re-open the dialog.
    params.delete('settings');
    params.delete('connected');
    params.delete('error');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate, open, qc]);

  return null;
}
