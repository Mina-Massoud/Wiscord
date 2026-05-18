import { useIntegrations } from '@/queries/integrations';
import type { IntegrationProvider } from '@/types/integration';

import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { ProviderTile } from './IntegrationsPanelProviderTile';
import { ConnectedAccountCard } from './IntegrationsPanelConnectedAccountCard';
import { TileGridSkeleton } from './IntegrationsPanelTileGridSkeleton';
import { EmptyTileGrid } from './IntegrationsPanelEmptyTileGrid';
import { ErrorRow } from './IntegrationsPanelErrorRow';

/**
 * Music integrations panel — Discord-style "Connections" layout.
 *
 * Layout mirrors Discord's Connections settings: a tile grid of providers the
 * user can add up top, then a stack of connected-account cards below with
 * per-provider "Display on profile" + "Display X as your status" switches.
 *
 * Toggles are visual-only today (persisted to `integration-prefs-store`);
 * profile-card and presence consumers will read the same prefs once those
 * surfaces ship.
 *
 * Brand logos live under public/logo/. Never substitute lucide icons for a
 * third-party brand — the user needs to recognize "this is Spotify" / "this
 * is YouTube Music" on sight, and a generic Music note doesn't do that.
 */

export interface ProviderMeta {
  provider: IntegrationProvider;
  name: string;
  blurb: string;
  /** Path under /public — must be the real brand logo, never a lucide stand-in. */
  logoSrc: string;
  /** Tile renders but Connect is disabled. Spotify gates dev-app API calls on
   *  the app owner having Premium — flip this off once that's cleared. */
  comingSoon?: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  {
    provider: 'spotify',
    name: 'Spotify',
    blurb: 'Vibe-check your friends and bring your liked songs into a room.',
    logoSrc: '/logo/spotify.webp',
    comingSoon: true,
  },
  {
    provider: 'google',
    name: 'YouTube Music',
    blurb: 'Connect your Google account so playlists ride along with you.',
    logoSrc: '/logo/youtube-music.webp',
  },
];

export function IntegrationsPanel(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useIntegrations();

  // OAuth round-trip handling (?settings=integrations&connected=…|error=…)
  // lives at the app root in IntegrationsReturnHandler — it owns the toast
  // and opens the dialog. This panel just renders the current state.

  const connected = data ?? [];
  const connectedSet = new Set(connected.map((row) => row.provider));
  const addable = PROVIDERS.filter((meta) => !connectedSet.has(meta.provider));
  const connectedMetas = PROVIDERS.flatMap((meta) => {
    const row = connected.find((c) => c.provider === meta.provider);
    return row ? [{ meta, connection: row }] : [];
  });

  return (
    <div>
      <SettingsPanelTitle>Connections</SettingsPanelTitle>

      <SettingsSection
        title="Add accounts to your profile"
        description="We won't share this anywhere without your say-so. Disconnect any time."
      >
        {isLoading ? (
          <TileGridSkeleton />
        ) : error ? (
          <ErrorRow onRetry={() => void refetch()} />
        ) : addable.length === 0 ? (
          <EmptyTileGrid />
        ) : (
          <div className="flex flex-wrap gap-3">
            {addable.map((meta) => (
              <ProviderTile key={meta.provider} meta={meta} />
            ))}
          </div>
        )}
      </SettingsSection>

      {connectedMetas.length > 0 ? (
        <>
          <SettingsDivider />
          <SettingsSection title="Connected">
            <div className="flex flex-col gap-3">
              {connectedMetas.map(({ meta, connection }) => (
                <ConnectedAccountCard key={meta.provider} meta={meta} connection={connection} />
              ))}
            </div>
          </SettingsSection>
        </>
      ) : null}

      <SettingsDivider />

      <SettingsSection title="Heads up" description="What's stored, and what isn't.">
        <ul className="text-ink-muted text-control flex list-disc flex-col gap-2 pl-5">
          <li>
            We never see your password — connections use the provider&apos;s own sign-in screen.
          </li>
          <li>
            Tokens are encrypted on our servers and only used to read what you ask us to share.
          </li>
          <li>Disconnect any time. We&apos;ll forget the connection on our end immediately.</li>
        </ul>
      </SettingsSection>
    </div>
  );
}
