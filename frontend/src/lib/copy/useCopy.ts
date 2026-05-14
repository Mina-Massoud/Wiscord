import { useCallback } from 'react';

import { useSession } from '@/queries/auth';
import { type CopyKey, resolveCopy } from './registry';

/**
 * Returns a `t(key)` function that looks up the right string for the
 * signed-in user's `voice_style`. Falls back to the `'default'` voice
 * when the session hasn't loaded yet or when the user is signed out,
 * so the UI never flashes a missing-key placeholder.
 */
export function useCopy(): (key: CopyKey) => string {
  const session = useSession();
  const voiceStyle = session.data?.voice_style ?? 'default';

  return useCallback((key: CopyKey) => resolveCopy(key, voiceStyle), [voiceStyle]);
}
