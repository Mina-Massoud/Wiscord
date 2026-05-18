import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { qk } from './keys';

export interface PrivacySettings {
  allowDmsFromStrangers: boolean;
  allowFriendRequestsFromEveryone: boolean;
  shareUsageAnalytics: boolean;
}

export function usePrivacy() {
  return useQuery({
    queryKey: qk.privacy.me(),
    queryFn: () => api<PrivacySettings>('/privacy'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) =>
      api<PrivacySettings>('/privacy', { method: 'PATCH', body: patch }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.privacy.me() });
      const previous = qc.getQueryData<PrivacySettings>(qk.privacy.me());
      if (previous) {
        qc.setQueryData<PrivacySettings>(qk.privacy.me(), { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.privacy.me(), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.privacy.me() });
    },
  });
}
