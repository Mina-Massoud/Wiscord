import { MessageCircle, MoreVertical } from 'lucide-react';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { PresenceDot } from '../atoms/PresenceDot';
import type { FakeFriend } from '@/data/fake-shell.types';

interface FriendRowProps {
  friend: FakeFriend;
}

const PRESENCE_LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

/**
 * Single row in the Friends list (Online / All tabs).
 * Avatar + name + presence label, with trailing action icons on hover.
 */
export function FriendRow({ friend }: FriendRowProps): React.JSX.Element {
  const { user } = friend;
  const avatarSrc = getIdenticonDataUrl(user.avatarSeed);

  return (
    <div className="group/friend hover:bg-surface-hover mx-2 flex h-[62px] cursor-pointer items-center gap-3 rounded-md px-3 transition-colors">
      <span className="relative shrink-0">
        <img
          src={avatarSrc}
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-full"
          loading="lazy"
        />
        <span className="absolute -right-0.5 -bottom-0.5">
          <PresenceDot
            presence={user.presence}
            size={12}
            ringClassName="ring-canvas group-hover/friend:ring-surface-hover"
          />
        </span>
      </span>

      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-ink text-subhead truncate font-semibold">{user.displayName}</span>
        <span className="text-ink-muted text-caption truncate">
          {user.status ?? PRESENCE_LABEL[user.presence]}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover/friend:opacity-100">
        <button
          type="button"
          aria-label={`Message ${user.displayName}`}
          onClick={(e) => e.preventDefault()}
          className="bg-surface-2 text-ink-muted hover:text-ink flex size-9 items-center justify-center rounded-full"
        >
          <MessageCircle className="size-5" />
        </button>
        <button
          type="button"
          aria-label={`More options for ${user.displayName}`}
          onClick={(e) => e.preventDefault()}
          className="bg-surface-2 text-ink-muted hover:text-ink flex size-9 items-center justify-center rounded-full"
        >
          <MoreVertical className="size-5" />
        </button>
      </div>
    </div>
  );
}
