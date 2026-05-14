import { Hash, Volume2 } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import type { FakeFocusingRoom } from '@/data/fake-shell.types';

interface FocusingNowListProps {
  rooms: FakeFocusingRoom[];
}

/**
 * "Focusing now" — rooms currently mid-Pomodoro. Static showcase for the
 * right rail. Each row mirrors the rhythm of RoomRow (server identicon +
 * channel-kind glyph overlay + name/server text block) so the panel reads
 * as a sibling of the left-rail Recent Rooms list. No handlers in v1.
 */
export function FocusingNowList({ rooms }: FocusingNowListProps): React.JSX.Element | null {
  if (rooms.length === 0) {
    return (
      <section aria-labelledby="focusing-now-heading">
        <SectionHeader id="focusing-now-heading">Focusing now</SectionHeader>
        <p className="text-ink-subtle text-caption px-4 pb-1">
          Quiet right now. Friends in focus sessions will show up here.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="focusing-now-heading">
      <SectionHeader id="focusing-now-heading">Focusing now</SectionHeader>
      <div className="flex flex-col gap-0.5">
        {rooms.map((room) => (
          <FocusingNowRow key={room.id} room={room} />
        ))}
      </div>
    </section>
  );
}

interface FocusingNowRowProps {
  room: FakeFocusingRoom;
}

function FocusingNowRow({ room }: FocusingNowRowProps): React.JSX.Element {
  const ChannelGlyph = room.channelKind === 'voice' ? Volume2 : Hash;
  const serverIconSrc = getIdenticonDataUrl(room.serverIconSeed);

  return (
    <div className="text-ink-muted hover:bg-glass-hover hover:text-ink mx-2 flex h-[42px] items-center gap-3 rounded-md px-2 transition-colors">
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

      <span className="flex shrink-0 items-center gap-1.5 leading-none">
        <span className="bg-presence-online rounded-pill size-1.5" aria-hidden />
        <span className="text-ink text-caption font-medium tabular-nums">{room.focusCount}</span>
        <span className="text-ink-subtle text-caption" aria-hidden>
          ·
        </span>
        <span className="text-ink-subtle text-caption tabular-nums">{room.minutesLeft}m</span>
        <span className="sr-only">
          {' '}
          — {room.focusCount} focusing, {room.minutesLeft} minutes left
        </span>
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
