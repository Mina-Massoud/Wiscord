import { useQuery, keepPreviousData } from '@tanstack/react-query';

import type { MusicTrack } from '@/types/music';

import { api } from './client';
import { qk } from './keys';

/**
 * YouTube Music search — proxied by /integrations/google/search. Requires
 * a Google connection (otherwise the request returns `not_found`).
 *
 * Disabled when the query is empty so we don't fire a request on every
 * keystroke before the user has typed anything meaningful.
 */
export function useMusicSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: qk.music.search(trimmed),
    queryFn: () =>
      api<MusicTrack[]>('/integrations/google/search', {
        search: { q: trimmed, limit: 10 },
      }),
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
