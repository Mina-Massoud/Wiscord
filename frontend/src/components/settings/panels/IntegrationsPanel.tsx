import { Loader2, X } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useIntegrationPrefs } from '@/lib/integration-prefs-store';
import { toast } from '@/lib/toast';
import {
  useDisconnectIntegration,
  useIntegrations,
  useStartIntegrationConnect,
} from '@/queries/integrations';
import type { Integration, IntegrationProvider } from '@/types/integration';

import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';

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

interface ProviderMeta {
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

interface ProviderTileProps {
  meta: ProviderMeta;
}

function ProviderTile({ meta }: ProviderTileProps): React.JSX.Element {
  const start = useStartIntegrationConnect();
  const isConnecting = start.isPending && start.variables === meta.provider;
  const disabled = meta.comingSoon === true || isConnecting;

  async function handleConnect(): Promise<void> {
    if (meta.comingSoon === true) {
      toast.info(`${meta.name}'s on the list. 👀`, {
        description: 'We need the green light from the provider — coming soon.',
      });
      return;
    }
    try {
      const { url } = await start.mutateAsync(meta.provider);
      window.location.assign(url);
    } catch (err) {
      toast.error(getStartErrorMessage(err, meta.name));
    }
  }

  const label = meta.comingSoon === true ? `${meta.name} (soon)` : `Add ${meta.name}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => void handleConnect()}
          disabled={isConnecting}
          className={
            'bg-glass-surface-2 border-glass-border hover:border-glass-border-strong relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border transition-colors ' +
            (disabled
              ? 'hover:border-glass-border opacity-60'
              : 'hover:bg-glass-callout cursor-pointer')
          }
        >
          {isConnecting ? (
            <Loader2 className="text-ink-muted size-5 animate-spin" />
          ) : (
            <img
              src={meta.logoSrc}
              alt=""
              width={28}
              height={28}
              loading="lazy"
              className="size-7 object-contain"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface ConnectedAccountCardProps {
  meta: ProviderMeta;
  connection: Integration;
}

function ConnectedAccountCard({ meta, connection }: ConnectedAccountCardProps): React.JSX.Element {
  const disconnect = useDisconnectIntegration();
  const isDisconnecting = disconnect.isPending && disconnect.variables === meta.provider;

  const showOnProfile = useIntegrationPrefs((s) => s.prefs[meta.provider]?.showOnProfile ?? false);
  const showAsStatus = useIntegrationPrefs((s) => s.prefs[meta.provider]?.showAsStatus ?? true);
  const setShowOnProfile = useIntegrationPrefs((s) => s.setShowOnProfile);
  const setShowAsStatus = useIntegrationPrefs((s) => s.setShowAsStatus);

  async function handleDisconnect(): Promise<void> {
    try {
      await disconnect.mutateAsync(meta.provider);
      toast.success(`${meta.name}'s out. Bye for now. 👋`);
    } catch {
      toast.error(`Couldn't disconnect ${meta.name}. Try again in a sec.`);
    }
  }

  const handle = connection.providerHandle ?? meta.name;
  const profileSwitchId = `integration-${meta.provider}-on-profile`;
  const statusSwitchId = `integration-${meta.provider}-as-status`;

  return (
    <div className="border-glass-border bg-glass-surface-2 overflow-hidden rounded-md border">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="bg-glass-callout flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
          <img
            src={meta.logoSrc}
            alt={`${meta.name} logo`}
            width={28}
            height={28}
            loading="lazy"
            className="size-7 object-contain"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink text-tab truncate font-semibold">{handle}</span>
          <span className="text-ink-muted text-caption truncate">{meta.name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Disconnect ${meta.name}`}
          className="text-ink-muted hover:text-destructive hover:bg-destructive/10"
          onClick={() => void handleDisconnect()}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
        </Button>
      </div>

      <div className="border-glass-border border-t">
        <ToggleRow
          id={profileSwitchId}
          label="Display on profile"
          checked={showOnProfile}
          onCheckedChange={(v) => setShowOnProfile(meta.provider, v)}
        />
        <div className="border-glass-border border-t" />
        <ToggleRow
          id={statusSwitchId}
          label={`Display ${meta.name} as your status`}
          checked={showAsStatus}
          onCheckedChange={(v) => setShowAsStatus(meta.provider, v)}
        />
      </div>
    </div>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}

function ToggleRow({ id, label, checked, onCheckedChange }: ToggleRowProps): React.JSX.Element {
  return (
    <label
      htmlFor={id}
      className="hover:bg-glass-callout/40 flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors"
    >
      <span className="text-ink text-control font-medium">{label}</span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function TileGridSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-3" aria-hidden>
      <Skeleton className="size-14 rounded-md" />
      <Skeleton className="size-14 rounded-md" />
    </div>
  );
}

function EmptyTileGrid(): React.JSX.Element {
  return (
    <p className="text-ink-muted text-control">
      Every available account is already linked. Nice. ✨
    </p>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-surface-2 flex items-center justify-between gap-4 rounded-md border px-4 py-3">
      <span className="text-destructive text-control">Couldn&apos;t load your connections.</span>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function getStartErrorMessage(err: unknown, providerName: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    err.code === 'integration_not_configured'
  ) {
    return `${providerName} isn't set up on this server yet.`;
  }
  return `Couldn't kick off ${providerName}. Try again in a moment.`;
}
