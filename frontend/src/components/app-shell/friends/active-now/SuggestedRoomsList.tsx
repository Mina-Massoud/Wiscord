import { Hash, Volume2 } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import type { FakeSuggestedRoom } from '@/data/fake-shell.types';

interface SuggestedRoomsListProps {
  rooms: FakeSuggestedRoom[];
}

/**
 * "Suggested rooms" — discovery showcase under the focusing list. Static
 * decorative tiles in v1; clicking does nothing (see docs/overview.md on
 * scope). Each tile leads with the channel name, then server + a one-line
 * blurb explaining why someone would drop in.
 */
export function SuggestedRoomsList({ rooms }: SuggestedRoomsListProps): React.JSX.Element | null {
  if (rooms.length === 0) return null;

  return (
    <section aria-labelledby="suggested-rooms-heading">
      <SectionHeader id="suggested-rooms-heading">Suggested rooms</SectionHeader>
      <div className="flex flex-col gap-0.5">
        {rooms.map((room) => (
          <SuggestedRoomRow key={room.id} room={room} />
        ))}
      </div>
    </section>
  );
}

interface SuggestedRoomRowProps {
  room: FakeSuggestedRoom;
}

function SuggestedRoomRow({ room }: SuggestedRoomRowProps): React.JSX.Element {
  const ChannelGlyph = room.channelKind === 'voice' ? Volume2 : Hash;
  const serverIconSrc = getIdenticonDataUrl(room.serverIconSeed);

  return (
    <div className="text-ink-muted hover:bg-glass-hover hover:text-ink mx-2 flex items-start gap-3 rounded-md px-2 py-2 transition-colors">
      <span className="relative mt-0.5 shrink-0">
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

      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-control flex items-baseline gap-1.5 truncate font-medium">
          <span className="truncate">{room.channelName}</span>
          <span className="text-ink-subtle text-caption truncate font-normal">
            · {room.serverName}
          </span>
        </span>
        <span className="text-ink-subtle text-caption">{room.blurb}</span>
      </span>
    </div>
  );
}

interface SectionHeaderProps {
  id: string;
  children: React.ReactNode;
}

function SectionHeader({ id, children }: SectionHeaderProps): React.JSX.Element {
  return (
    <div className="mt-4 flex items-center justify-between px-4 pb-1">
      <span id={id} className="text-ink-subtle text-badge font-bold tracking-wider uppercase">
        {children}
      </span>
    </div>
  );
}
