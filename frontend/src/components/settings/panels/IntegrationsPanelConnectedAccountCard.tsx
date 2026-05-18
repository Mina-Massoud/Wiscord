import { useDisconnectIntegration } from '@/queries/integrations';
import { useIntegrationPrefs } from '@/lib/integration-prefs-store';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import type { Integration } from '@/types/integration';
import { ToggleRow } from './IntegrationsPanelToggleRow';
import type { ProviderMeta } from './IntegrationsPanel';

interface ConnectedAccountCardProps {
  meta: ProviderMeta;
  connection: Integration;
}

export function ConnectedAccountCard({
  meta,
  connection,
}: ConnectedAccountCardProps): React.JSX.Element {
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
