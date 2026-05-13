import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api, ApiError } from '@/queries/client';
import { qk } from '@/queries/keys';
import { useSession } from '@/queries/auth';
import { normalizeProfileError } from '@/lib/auth';
import type { Profile, ProfileError, ProfileUpdate } from '@/types/auth';

/**
 * `useMyProfile` is now an alias of `useSession` — the backend exposes a
 * single endpoint that returns the auth identity and profile fields in one
 * shot, so there is no separate fetch.
 */
export function useMyProfile(): UseQueryResult<Profile | null> {
  return useSession();
}

/**
 * Update the authenticated user's profile. Writes the result into the
 * `auth.session` cache so consumers re-render in the same tick.
 */
export function useUpdateProfile(): UseMutationResult<Profile, ProfileError, ProfileUpdate> {
  const qc = useQueryClient();

  return useMutation<Profile, ProfileError, ProfileUpdate>({
    mutationFn: async (patch) => {
      try {
        return await api<Profile>('/auth/me', { method: 'PATCH', body: patch });
      } catch (err) {
        throw normalizeProfileError(err);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(qk.auth.session(), data);
      qc.setQueryData(qk.profiles.me(), data);
    },
  });
}

/**
 * Debounced username availability check.
 * Queries when `candidate.length >= 2`, debounced 300ms.
 * Returns `{ isChecking, isAvailable }`:
 *   - `isAvailable === true`  → username is free
 *   - `isAvailable === false` → username is taken
 *   - `isAvailable === null`  → not yet checked
 */
export function useUsernameAvailable(
  candidate: string,
): { isChecking: boolean; isAvailable: boolean | null } {
  const [debouncedCandidate, setDebouncedCandidate] = useState(candidate);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedCandidate(candidate), 300);
    return () => clearTimeout(id);
  }, [candidate]);

  const [state, setState] = useState<{ checking: boolean; available: boolean | null }>({
    checking: false,
    available: null,
  });

  useEffect(() => {
    if (debouncedCandidate.length < 2) {
      setState({ checking: false, available: null });
      return;
    }

    let cancelled = false;
    setState({ checking: true, available: null });

    api<{ available: boolean }>('/auth/check-username', {
      search: { username: debouncedCandidate },
    })
      .then(({ available }) => {
        if (!cancelled) setState({ checking: false, available });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // ApiError with code "invalid_input" → treat as not-available so the
        // user sees feedback rather than a silent hang.
        if (err instanceof ApiError && err.code === 'invalid_input') {
          setState({ checking: false, available: false });
          return;
        }
        setState({ checking: false, available: null });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedCandidate]);

  const isChecking = state.checking || candidate !== debouncedCandidate;
  return { isChecking, isAvailable: state.available };
}
