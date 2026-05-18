import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Integration, IntegrationProvider } from '@/types/integration';

import { api } from './client';
import { qk } from './keys';

/**
 * Music integrations — step 1: list / connect / disconnect.
 *
 * Connecting is a redirect flow: the backend hands us a provider auth URL,
 * the browser navigates there, the provider sends the user back to the
 * backend callback, which then redirects to /app?settings=integrations&connected=…
 * The settings panel handles that query string on mount.
 */

export function useIntegrations() {
  return useQuery({
    queryKey: qk.integrations.all(),
    queryFn: () => api<Integration[]>('/integrations'),
    staleTime: 60 * 1000,
  });
}

export function useStartIntegrationConnect() {
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      api<{ url: string }>(`/integrations/${provider}/start`),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: IntegrationProvider) =>
      api<{ disconnected: true }>(`/integrations/${provider}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.integrations.all() });
    },
  });
}
