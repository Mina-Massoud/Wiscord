import { NavLink } from 'react-router';
import { Hash, Volume2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getIdenticonDataUrl } from '@/lib/avatar';
import type { RecentRoom } from '@/lib/recent-rooms-store';

interface RoomRowProps {
  room: RecentRoom;
}

/**
 * Single channel row in the "Recent rooms" list.
 * Server icon + a hash/voice glyph + channel name, with the parent server
 * as the subtitle. Clicks navigate to the real channel route.
 */
export function RoomRow({ room }: RoomRowProps): React.JSX.Element {
  const ChannelGlyph = room.channelType === 'voice' ? Volume2 : Hash;
  const serverIconSrc = room.serverIconUrl ?? getIdenticonDataUrl(room.serverId);

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
    </NavLink>
  );
}
