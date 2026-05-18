import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { api, ApiError } from '@/queries/client';
import { qk } from '@/queries/keys';
import { normalizeAuthError } from '@/lib/auth';
import { useVoiceSessionStore } from '@/lib/voice-session-store';
import type { AuthError, Profile } from '@/types/auth';

/**
 * `useSession` returns the authenticated profile (or null when signed out).
 *
 * The backend exposes a single endpoint that returns BOTH the auth identity
 * and the profile fields — there is no separate Supabase session shape any
 * more. `Session` from before is now just `Profile | null`. AuthContext
 * primes this cache on boot; consumers should always read it through this
 * hook so React Query keeps everything in sync.
 */
export function useSession(): UseQueryResult<Profile | null> {
  return useQuery<Profile | null>({
    queryKey: qk.auth.session(),
    queryFn: async () => {
      try {
        return await api<Profile>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

/**
 * Send a magic-link email. Always resolves true server-side (anti-enumeration);
 * failures are network/rate-limit and surface as AuthError.
 */
export function useSendMagicLink(): UseMutationResult<
  { sent: true },
  AuthError,
  { email: string }
> {
  return useMutation<{ sent: true }, AuthError, { email: string }>({
    mutationFn: async ({ email }) => {
      try {
        const res = await api<{ sent: true }>('/auth/magic-link', {
          method: 'POST',
          body: { email, redirectTo: '/' },
        });
        return res;
      } catch (err) {
        throw normalizeAuthError(err);
      }
    },
  });
}

/**
 * Sign out — clears the server-side cookie and the local session cache.
 */
export function useSignOut(): UseMutationResult<void, AuthError, void> {
  const qc = useQueryClient();

  return useMutation<void, AuthError, void>({
    mutationFn: async () => {
      try {
        await api<{ signedOut: true }>('/auth/signout', { method: 'POST' });
      } catch (err) {
        throw normalizeAuthError(err);
      }
    },
    onSettled: () => {
      // Drop any live LiveKit voice session before the auth state clears
      // so the global `<LiveKitRoom>` disconnects cleanly. Without this,
      // the room would keep its peer connection open against the now-
      // invalidated token until the next browser navigation.
      useVoiceSessionStore.getState().leaveChannel();
      qc.setQueryData(qk.auth.session(), null);
      qc.clear();
    },
  });
}
