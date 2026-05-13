import { useCallback } from 'react';

import { useSession, useSignOut } from '@/queries/auth';
import type { Profile, ProfileError } from '@/types/auth';

/**
 * Single auth surface for pages and route guards.
 *
 * With the Express backend the "session" is now just the authenticated
 * profile (or null when signed out) — there is no separate auth/profile
 * distinction like Supabase had. `user` and `profile` are returned as the
 * same value so existing call sites keep working unchanged.
 */
export interface UseAuthResult {
  session: Profile | null;
  user: Profile | null;
  profile: Profile | null;
  /** true when the user has finished onboarding (onboarded_at is set). */
  isOnboarded: boolean;
  /** true while we're still probing /auth/me on initial load. */
  isLoading: boolean;
  /** non-null when the probe errored in a non-401 way (e.g. network). */
  profileError: ProfileError | null;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const sessionQuery = useSession();
  const signOutMutation = useSignOut();

  const profile = sessionQuery.data ?? null;
  const isOnboarded = !!profile?.onboarded_at;
  const isLoading = sessionQuery.isLoading;

  const profileError: ProfileError | null = sessionQuery.error
    ? { code: 'unknown', message: 'Could not load your profile.', cause: sessionQuery.error }
    : null;

  const signOut = useCallback(async (): Promise<void> => {
    await signOutMutation.mutateAsync();
  }, [signOutMutation]);

  return {
    session: profile,
    user: profile,
    profile,
    isOnboarded,
    isLoading,
    profileError,
    signOut,
  };
}
