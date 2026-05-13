import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { api, ApiError, queryClient } from '@/queries/client';
import { qk } from '@/queries/keys';
import type { Profile } from '@/types/auth';
import { logger } from '@/lib/logger';

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Boot-time auth gate. On mount we hit `/auth/me` once to find out whether
 * the browser already has a valid session cookie:
 *   - 200 → prime the React Query cache so route guards read it synchronously
 *   - 401 → cache `null` so guards bounce to /sign-in
 *
 * After this initial probe React Query owns the session state; the
 * `useSignOut` mutation writes `null` directly into the cache, and the next
 * sign-in writes the new profile.
 *
 * There is no `onAuthStateChange` listener any more — auth lifecycle is now
 * a single HTTP round-trip per page load. Cross-tab sign-out is handled by
 * the cookie itself (a different tab can't see a session it doesn't have).
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const me = await api<Profile>('/auth/me');
        if (cancelled) return;
        queryClient.setQueryData(qk.auth.session(), me);
        logger.info('auth: session restored', me.id);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          queryClient.setQueryData(qk.auth.session(), null);
        } else {
          // Network or 5xx — still let the app render; useSession will retry.
          queryClient.setQueryData(qk.auth.session(), null);
          logger.warn('auth: /auth/me probe failed', err);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <></>;

  return <>{children}</>;
}
