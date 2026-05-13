import { NavLink } from 'react-router';
import { Hash, Volume2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { UnreadBadge } from '../atoms/UnreadBadge';
import type { FakeRecentRoom } from '@/data/fake-shell.types';

interface RoomRowProps {
  room: FakeRecentRoom;
}

/**
 * Single channel row in the "Recent rooms" list.
 * Server icon + a hash/voice glyph + channel name, with the parent server
 * as the subtitle. Clicks navigate to the channel route (the page is a
 * placeholder for now, but the route is real).
 */
export function RoomRow({ room }: RoomRowProps): React.JSX.Element {
  const ChannelGlyph = room.channelKind === 'voice' ? Volume2 : Hash;
  const serverIconSrc = getIdenticonDataUrl(room.serverIconSeed);

  return (
    <NavLink
      to={`/app/servers/${room.serverId}/channels/${room.channelId}`}
      className={({ isActive }) =>
        cn(
          'mx-2 flex h-[42px] items-center gap-3 rounded-md px-2 transition-colors',
          isActive
            ? 'bg-glass-active text-ink'
            : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
        )
      }
    >
      <span className="relative shrink-0">
        <img
          src={serverIconSrc}
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-md"
          loading="lazy"
        />
        <span className="bg-glass-surface-1 border-glass-border absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border">
          <ChannelGlyph className="text-ink-muted size-3" />
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-control truncate font-medium">{room.channelName}</span>
        <span className="text-ink-subtle text-caption truncate">{room.serverName}</span>
      </span>

      {room.hasUnread && room.unreadCount ? <UnreadBadge count={room.unreadCount} /> : null}
    </NavLink>
  );
}
