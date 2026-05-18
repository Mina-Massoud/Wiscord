import { useCallback } from 'react';

import { useSession } from '@/queries/auth';
import { type CopyKey, resolveCopy } from './registry';

/**
 * Returns a `t(key)` function that looks up the right string for the
 * signed-in user's `vibe`. Falls back to the `'genz'` vibe (the historic
 * Wiscord default) when the session hasn't loaded yet or when the user
 * is signed out, so the UI never flashes a missing-key placeholder.
 */
export function useCopy(): (key: CopyKey) => string {
  const session = useSession();
  const vibe = session.data?.vibe ?? 'genz';

  return useCallback((key: CopyKey) => resolveCopy(key, vibe), [vibe]);
}
