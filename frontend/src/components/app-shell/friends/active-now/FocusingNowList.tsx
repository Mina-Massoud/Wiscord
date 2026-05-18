import type { FakeFocusingRoom } from '@/data/fake-shell.types';
import { FocusingNowRow } from './FocusingNowListFocusingNowRow';
import { SectionHeader } from './FocusingNowListSectionHeader';

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
