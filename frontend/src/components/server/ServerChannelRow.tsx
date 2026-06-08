import { Hash, Volume2 } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { cn } from '@/lib/cn';
import type { ChannelDto } from '@/queries/channels';
import { UnreadBadge } from '@/components/app-shell/atoms/UnreadBadge';
import { ChannelRowContextMenu } from './ChannelRowContextMenu';

interface ServerChannelRowProps {
  channel: ChannelDto;
  serverId: string;
  isOwner: boolean;
}

export function ServerChannelRow({
  channel,
  serverId,
  isOwner,
}: ServerChannelRowProps): React.JSX.Element {
  const { channelId: activeChannelId } = useParams<{ channelId?: string }>();
  const isActive = activeChannelId === channel.id;
  const Icon = channel.type === 'text' ? Hash : Volume2;
  const unreadCount = channel.unreadCount ?? 0;
  const hasUnread = !isActive && unreadCount > 0;

  return (
    <ChannelRowContextMenu channel={channel} serverId={serverId} isOwner={isOwner}>
      <Link
        to={`/app/servers/${serverId}/channels/${channel.id}`}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
          isActive && 'bg-surface-active text-ink',
          // Leave right-side room for the hover gear button when owner
          'pr-8',
        )}
        >
        <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
        <span
          className={cn(
            'text-tab min-w-0 truncate font-medium',
            hasUnread ? 'text-ink font-semibold' : 'text-ink',
          )}
        >
          {channel.name}
        </span>
        {hasUnread ? (
          <UnreadBadge count={unreadCount} className="ml-auto shrink-0" />
        ) : null}
      </Link>
    </ChannelRowContextMenu>
  );
}
