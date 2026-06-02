import { getIdenticonDataUrl } from '@/lib/avatar';

/** Resolve the rail / list icon for a server row from API data. */
export function serverIconSrc(server: { id: string; iconUrl: string | null }): string {
  return server.iconUrl ?? getIdenticonDataUrl(server.id);
}
