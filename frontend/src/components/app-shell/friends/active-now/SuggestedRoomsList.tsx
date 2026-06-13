import { useDiscoverServers } from '@/queries/servers';
import { SuggestedRoomRow } from './SuggestedRoomsListSuggestedRoomRow';
import { SectionHeader } from './SuggestedRoomsListSectionHeader';

/**
 * "Suggested rooms" — public servers the user hasn't joined yet, from
 * `GET /servers/discover`. Three states: a quiet skeleton while loading, a
 * silent omit on error (this is a secondary discovery rail, not a primary
 * surface — a red error card here would be noise), and an omit when empty so
 * the rail collapses cleanly on a fresh instance with no public servers.
 */
export function SuggestedRoomsList(): React.JSX.Element | null {
  const { data: servers, isLoading, isError } = useDiscoverServers();

  if (isLoading) {
    return (
      <section aria-labelledby="suggested-rooms-heading">
        <SectionHeader id="suggested-rooms-heading">Suggested rooms</SectionHeader>
        <div className="flex flex-col gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mx-2 flex items-center gap-3 rounded-md px-2 py-2">
              <div className="bg-glass-surface-1 size-8 shrink-0 animate-pulse rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="bg-glass-surface-1 h-3 w-2/3 animate-pulse rounded" />
                <div className="bg-glass-surface-1 h-2.5 w-1/3 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !servers || servers.length === 0) return null;

  return (
    <section aria-labelledby="suggested-rooms-heading">
      <SectionHeader id="suggested-rooms-heading">Suggested rooms</SectionHeader>
      <div className="flex flex-col gap-0.5">
        {servers.map((server) => (
          <SuggestedRoomRow key={server.id} server={server} />
        ))}
      </div>
    </section>
  );
}
