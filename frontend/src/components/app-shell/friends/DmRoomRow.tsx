import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { UnreadBadge } from '../atoms/UnreadBadge';
import type { DmRoomDto } from '@/queries/dms';

interface DmRoomRowProps {
  room: DmRoomDto;
}

export function DmRoomRow({ room }: DmRoomRowProps): React.JSX.Element {
  const recipient = room.recipient;
  const avatarSrc = recipient.avatarUrl || getIdenticonDataUrl(recipient.id);

  return (
    <NavLink
      to={`/app/dms/${room.id}`}
      className={({ isActive }) =>
        cn(
          'mx-2 flex h-[46px] items-center gap-3 rounded-md px-2 transition-colors',
          isActive
            ? 'bg-glass-active text-ink'
            : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
        )
      }
    >
      <span className="relative shrink-0">
        <img
          src={avatarSrc}
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-full object-cover"
          loading="lazy"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-control truncate font-medium">
          {recipient.displayName || recipient.username}
        </span>
        <span className="text-ink-subtle text-caption truncate">
          {room.lastMessagePreview || `@${recipient.username}`}
        </span>
      </span>

      {room.unreadCount && room.unreadCount > 0 ? (
        <UnreadBadge count={room.unreadCount} />
      ) : null}
    </NavLink>
  );
}
