import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, ApiError, API_URL } from '@/queries/client';
import { qk } from '@/queries/keys';

export type ChannelType = 'text' | 'voice';

export interface ChannelDto {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  position: number;
  createdAt: string;
}

interface ChannelsEnvelope {
  channels: ChannelDto[];
}

interface ChannelEnvelope {
  channel: ChannelDto;
}

export interface CreateChannelInput {
  name: string;
  type: ChannelType;
}

export function useServerChannels(serverId: string | undefined): UseQueryResult<ChannelDto[]> {
  return useQuery<ChannelDto[]>({
    queryKey: qk.channels.byServer(serverId ?? ''),
    queryFn: async () => {
      const result = await api<ChannelsEnvelope>(`/servers/${serverId}/channels`);
      return result.channels;
    },
    enabled: Boolean(serverId),
    staleTime: 5 * 60 * 1000,
  });
}

/** First text channel — used for post-create redirect and bare `/servers/:id` routes. */
export function firstTextChannel(channels: ChannelDto[]): ChannelDto | undefined {
  return channels.find((c) => c.type === 'text');
}

export function useCreateChannel(
  serverId: string,
): UseMutationResult<ChannelDto, ApiError, CreateChannelInput> {
  const queryClient = useQueryClient();
  return useMutation<ChannelDto, ApiError, CreateChannelInput>({
    mutationFn: async (input) => {
      const result = await api<ChannelEnvelope>(`/servers/${serverId}/channels`, {
        method: 'POST',
        body: input,
      });
      return result.channel;
    },
    onSuccess: (channel) => {
      queryClient.setQueryData<ChannelDto[]>(qk.channels.byServer(serverId), (prev) => {
        const list = prev ?? [];
        return [...list, channel].sort((a, b) => a.position - b.position);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.channels.byServer(serverId) });
    },
  });
}

export interface UpdateChannelInput {
  serverId: string;
  channelId: string;
  name: string;
}

export interface DeleteChannelInput {
  serverId: string;
  channelId: string;
}

export function useUpdateChannel(): UseMutationResult<ChannelDto, ApiError, UpdateChannelInput> {
  const queryClient = useQueryClient();
  return useMutation<ChannelDto, ApiError, UpdateChannelInput>({
    mutationFn: async ({ serverId, channelId, name }) => {
      const result = await api<ChannelEnvelope>(
        `/servers/${serverId}/channels/${channelId}`,
        { method: 'PATCH', body: { name } },
      );
      return result.channel;
    },
    onSuccess: (channel, { serverId }) => {
      queryClient.setQueryData<ChannelDto[]>(qk.channels.byServer(serverId), (old) =>
        old ? old.map((c) => (c.id === channel.id ? channel : c)) : old,
      );
    },
  });
}

export function useDeleteChannel(): UseMutationResult<void, ApiError, DeleteChannelInput> {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, DeleteChannelInput>({
    mutationFn: async ({ serverId, channelId }) => {
      // DELETE returns 204 No Content — use raw fetch to avoid JSON parse on empty body
      const res = await fetch(
        `${API_URL}/servers/${serverId}/channels/${channelId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (res.status !== 204 && !res.ok) {
        let code = 'unknown';
        let message = 'Failed to delete channel.';
        try {
          const body = (await res.json()) as { error?: { code?: string; message?: string } };
          code = body.error?.code ?? code;
          message = body.error?.message ?? message;
        } catch { /* ignore */ }
        throw new ApiError(res.status, code, message);
      }
    },
    onSuccess: (_, { serverId, channelId }) => {
      queryClient.setQueryData<ChannelDto[]>(qk.channels.byServer(serverId), (old) =>
        old ? old.filter((c) => c.id !== channelId) : old,
      );
    },
  });
}
