import { Button } from '@/components/ui/button';
import type { ChannelDto } from '@/queries/channels';
import { ChannelChatView } from './chat/ChannelChatView';
import { ServerChannelVoicePane } from './ServerChannelVoicePane';

interface ServerChannelMainPaneProps {
  channel: ChannelDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function ServerChannelMainPane({
  channel,
  isLoading,
  isError,
  onRetry,
}: ServerChannelMainPaneProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="bg-glass-surface-1 h-6 w-48 animate-pulse rounded-md" />
        <div className="bg-glass-surface-1 h-4 w-full max-w-md animate-pulse rounded-md" />
        <div className="bg-glass-surface-1 h-4 w-full max-w-sm animate-pulse rounded-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-ink-muted text-body">Couldn&apos;t load this channel.</p>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="text-ink-muted text-body flex flex-1 items-center justify-center px-6">
        Pick a channel from the sidebar.
      </div>
    );
  }

  if (channel.type === 'text') {
    return <ChannelChatView channel={channel} />;
  }

  return <ServerChannelVoicePane channel={channel} />;
}
