import { Hash, Volume2 } from 'lucide-react';
import { getIdenticonDataUrl } from '@/lib/avatar';
import type { FakeFocusingRoom } from '@/data/fake-shell.types';

interface FocusingNowRowProps {
  room: FakeFocusingRoom;
}

export function FocusingNowRow({ room }: FocusingNowRowProps): React.JSX.Element {
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
