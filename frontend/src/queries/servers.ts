import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { api, getSocket, type ApiError, type ServerUnreadChanged } from '@/queries/client';
import type { ChannelDto } from '@/queries/channels';
import { qk } from '@/queries/keys';

export interface ServerDto {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
}

/** A public server in the discovery rail — a non-member's view. */
export interface DiscoverServerDto {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  /** First text channel to land in on join, or null when the server has none. */
  firstChannelId: string | null;
  blurb: string | null;
}

interface DiscoverServersEnvelope {
  servers: DiscoverServerDto[];
}

export interface ServerUnreadDto {
  serverId: string;
  hasUnread: boolean;
  unreadCount: number;
}

interface ServersEnvelope {
  servers: ServerDto[];
}

interface ServerEnvelope {
  server: ServerDto;
}

export interface CreateServerResult {
  server: ServerDto;
  channels: ChannelDto[];
}

export interface CreateServerInput {
  name: string;
  iconUrl?: string | null;
}

export interface UpdateServerInput {
  serverId: string;
  name?: string;
  iconUrl?: string | null;
  isPublic?: boolean;
}

/** Servers the signed-in user belongs to (replaces demo `fakeServers` in the rail). */
export function useMyServers(): UseQueryResult<ServerDto[]> {
  return useQuery<ServerDto[]>({
    queryKey: qk.servers.mine(),
    queryFn: async () => {
      const result = await api<ServersEnvelope>('/servers');
      return result.servers;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Public servers the user hasn't joined — powers the "Suggested rooms" rail. */
export function useDiscoverServers(): UseQueryResult<DiscoverServerDto[]> {
  return useQuery<DiscoverServerDto[]>({
    queryKey: qk.servers.discover(),
    queryFn: async () => {
      const result = await api<DiscoverServersEnvelope>('/servers/discover');
      return result.servers;
    },
    staleTime: 60 * 1000,
  });
}

export function useServer(serverId: string | undefined): UseQueryResult<ServerDto | null> {
  return useQuery<ServerDto | null>({
    queryKey: qk.servers.byId(serverId ?? ''),
    queryFn: async () => {
      const result = await api<ServerEnvelope>(`/servers/${serverId}`);
      return result.server;
    },
    enabled: Boolean(serverId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateServer(): UseMutationResult<
  CreateServerResult,
  ApiError,
  CreateServerInput
> {
  const queryClient = useQueryClient();
  return useMutation<CreateServerResult, ApiError, CreateServerInput>({
    mutationFn: async (input) => {
      return api<CreateServerResult>('/servers', {
        method: 'POST',
        body: {
          name: input.name,
          iconUrl: input.iconUrl ?? null,
        },
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(qk.channels.byServer(result.server.id), result.channels);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.servers.root });
    },
  });
}

export function useUpdateServer(): UseMutationResult<ServerDto, ApiError, UpdateServerInput> {
  const queryClient = useQueryClient();
  return useMutation<ServerDto, ApiError, UpdateServerInput>({
    mutationFn: async ({ serverId, ...patch }) => {
      const result = await api<ServerEnvelope>(`/servers/${serverId}`, {
        method: 'PATCH',
        body: patch,
      });
      return result.server;
    },
    onSuccess: (server) => {
      // Update the individual server cache
      queryClient.setQueryData(qk.servers.byId(server.id), server);
      // Update within the list cache without a full refetch
      queryClient.setQueryData<ServerDto[]>(qk.servers.mine(), (old) =>
        old ? old.map((s) => (s.id === server.id ? server : s)) : old,
      );
    },
  });
}

export function useDeleteServer(): UseMutationResult<void, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (serverId) => {
      await api(`/servers/${serverId}`, { method: 'DELETE' });
    },
    onSuccess: (_, serverId) => {
      queryClient.setQueryData<ServerDto[]>(qk.servers.mine(), (prev) =>
        (prev ?? []).filter((s) => s.id !== serverId),
      );
      queryClient.removeQueries({ queryKey: qk.servers.byId(serverId) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.servers.root });
    },
  });
}

export function useLeaveServer(): UseMutationResult<void, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (serverId) => {
      await api(`/servers/${serverId}?action=leave`, { method: 'DELETE' });
    },
    onSuccess: (_, serverId) => {
      queryClient.setQueryData<ServerDto[]>(qk.servers.mine(), (prev) =>
        (prev ?? []).filter((s) => s.id !== serverId),
      );
      queryClient.removeQueries({ queryKey: qk.servers.byId(serverId) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.servers.root });
    },
  });
}

interface ServersUnreadEnvelope {
  servers: ServerUnreadDto[];
}

export function useServersUnread(): UseQueryResult<ServerUnreadDto[], ApiError> {
  return useQuery<ServerUnreadDto[], ApiError>({
    queryKey: qk.servers.unread(),
    queryFn: async () => {
      const result = await api<ServersUnreadEnvelope>('/servers/unread');
      return result.servers;
    },
    staleTime: 10_000,
  });
}

export function useServerUnreadRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onServerUnreadChanged = (event: ServerUnreadChanged) => {
      void (async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: qk.servers.unread() }),
          queryClient.invalidateQueries({ queryKey: qk.channels.byServer(event.serverId) }),
        ]);

        const channels = queryClient.getQueryData<ChannelDto[]>(
          qk.channels.byServer(event.serverId),
        );
        if (!channels) return;

        const unreadCount = channels.reduce(
          (total, channel) => total + (channel.unreadCount ?? 0),
          0,
        );

        queryClient.setQueryData<ServerUnreadDto[]>(qk.servers.unread(), (servers) => {
          if (!servers) return servers;
          const nextUnread = {
            serverId: event.serverId,
            hasUnread: unreadCount > 0,
            unreadCount,
          };
          return servers.some((server) => server.serverId === event.serverId)
            ? servers.map((server) => (server.serverId === event.serverId ? nextUnread : server))
            : [...servers, nextUnread];
        });
      })();
    };

    socket.on('server_unread:changed', onServerUnreadChanged);

    return () => {
      socket.off('server_unread:changed', onServerUnreadChanged);
    };
  }, [queryClient]);
}
