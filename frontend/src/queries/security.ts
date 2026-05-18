import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { qk } from './keys';

export interface CurrentSession {
  device: string;
  ipMasked: string;
  signedInAt: string | null;
}

interface CurrentSessionResponse {
  current: CurrentSession;
}

export function useCurrentSession() {
  return useQuery({
    queryKey: qk.security.currentSession(),
    queryFn: () => api<CurrentSessionResponse>('/security/sessions'),
    staleTime: 60 * 1000,
  });
}

export function useSignOutOtherDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ signedOutAt: string }>('/security/sign-out-others', { method: 'POST' }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.security.root });
    },
  });
}
