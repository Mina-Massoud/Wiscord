import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, type ApiError } from '@/queries/client';
import { qk } from '@/queries/keys';

export interface InviteDto {
  id: string;
  code: string;
  serverId: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isDefault: boolean;
  createdAt: string;
}

interface InviteEnvelope {
  invite: InviteDto;
}

interface InvitesEnvelope {
  invites: InviteDto[];
}

interface RedeemResultEnvelope {
  serverId: string;
}

/** Default unlimited server invite (created on server setup). */
export function useServerInvite(serverId: string | undefined): UseQueryResult<InviteDto | null> {
  return useQuery<InviteDto | null>({
    queryKey: qk.invites.byServer(serverId ?? ''),
    queryFn: async () => {
      const result = await api<InviteEnvelope>(`/invites/servers/${serverId}`);
      return result.invite;
    },
    enabled: Boolean(serverId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useServerInvites(serverId: string | undefined): UseQueryResult<InviteDto[]> {
  return useQuery<InviteDto[]>({
    queryKey: [...qk.invites.byServer(serverId ?? ''), 'all'] as const,
    queryFn: async () => {
      const result = await api<InvitesEnvelope>(`/invites/servers/${serverId}/all`);
      return result.invites;
    },
    enabled: Boolean(serverId),
    staleTime: 60 * 1000,
  });
}

export function useCreateServerInvite(
  serverId: string,
): UseMutationResult<InviteDto, ApiError, { maxUses?: 1 } | void> {
  const queryClient = useQueryClient();
  return useMutation<InviteDto, ApiError, { maxUses?: 1 } | void>({
    mutationFn: async (input) => {
      const result = await api<InviteEnvelope>(`/invites/servers/${serverId}`, {
        method: 'POST',
        body: input ?? {},
      });
      return result.invite;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.invites.byServer(serverId) });
    },
  });
}

export function useRedeemInvite(): UseMutationResult<
  RedeemResultEnvelope,
  ApiError,
  { code: string }
> {
  const queryClient = useQueryClient();
  return useMutation<RedeemResultEnvelope, ApiError, { code: string }>({
    mutationFn: async ({ code }) => {
      const result = await api<RedeemResultEnvelope>(
        `/invites/${encodeURIComponent(code)}/redeem`,
        { method: 'POST' },
      );
      return { serverId: result.serverId };
    },
    onSuccess: async ({ serverId }) => {
      const [server, channels] = await Promise.all([
        api<{ server: unknown }>(`/servers/${serverId}`).then((r) => r.server),
        api<{ channels: unknown[] }>(`/servers/${serverId}/channels`).then((r) => r.channels),
      ]);
      queryClient.setQueryData(qk.servers.byId(serverId), server);
      queryClient.setQueryData(qk.channels.byServer(serverId), channels);
      void queryClient.invalidateQueries({ queryKey: qk.servers.root });
    },
  });
}
