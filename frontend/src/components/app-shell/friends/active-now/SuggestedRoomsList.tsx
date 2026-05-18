import type { FakeSuggestedRoom } from '@/data/fake-shell.types';
import { SuggestedRoomRow } from './SuggestedRoomsListSuggestedRoomRow';
import { SectionHeader } from './SuggestedRoomsListSectionHeader';

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
