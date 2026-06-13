import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDiscoverServers } from '@/queries/servers';
import { DiscoverServerCard } from './DiscoverServerCard';

/**
 * Discover page body — public servers from `GET /servers/discover`. Renders all
 * three async states: skeleton grid while loading, an error card with retry,
 * and a designed empty state when no servers are public yet.
 */
export function DiscoverServerGrid(): React.JSX.Element {
  const { data: servers, isLoading, isError, refetch } = useDiscoverServers();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="bg-glass-surface-1 border-glass-border flex items-center gap-3 rounded-lg border p-4"
          >
            <div className="bg-glass-surface-2 size-12 shrink-0 animate-pulse rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="bg-glass-surface-2 h-3.5 w-2/3 animate-pulse rounded" />
              <div className="bg-glass-surface-2 h-2.5 w-1/3 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-ink-muted text-control">Couldn&apos;t load study rooms. Try again?</p>
        <Button variant="secondary" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!servers || servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <span className="bg-glass-surface-1 text-ink-muted mb-1 flex size-12 items-center justify-center rounded-full">
          <Compass className="size-6" aria-hidden />
        </span>
        <h2 className="text-ink text-subhead font-semibold">No public rooms yet</h2>
        <p className="text-ink-muted text-control max-w-sm">
          Be the first — open a server&apos;s settings and turn on{' '}
          <span className="text-ink font-medium">Discovery</span> to list it here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
      {servers.map((server) => (
        <DiscoverServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
