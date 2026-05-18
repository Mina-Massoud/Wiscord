import { useStartIntegrationConnect } from '@/queries/integrations';
import { toast } from '@/lib/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import type { ProviderMeta } from './IntegrationsPanel';

interface ProviderTileProps {
  meta: ProviderMeta;
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

export function ProviderTile({ meta }: ProviderTileProps): React.JSX.Element {
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
