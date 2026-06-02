import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, type ApiError } from '@/queries/client';
import { qk } from '@/queries/keys';
import type {
  EventWithMeta,
  CreateEventDto,
  UpdateEventDto,
  RsvpStatus,
} from '@/types/event';

interface EventsEnvelope {
  events: EventWithMeta[];
}

interface EventEnvelope {
  event: EventWithMeta;
}

export function useServerEvents(serverId: string | undefined): UseQueryResult<EventWithMeta[]> {
  return useQuery<EventWithMeta[]>({
    queryKey: qk.events.byServer(serverId ?? ''),
    queryFn: async () => {
      const result = await api<EventsEnvelope>(`/servers/${serverId}/events`);
      return result.events;
    },
    enabled: Boolean(serverId),
    staleTime: 60 * 1000,
  });
}

export function useCreateEvent(
  serverId: string,
): UseMutationResult<EventWithMeta, ApiError, CreateEventDto> {
  const queryClient = useQueryClient();
  return useMutation<EventWithMeta, ApiError, CreateEventDto>({
    mutationFn: async (input) => {
      const result = await api<EventEnvelope>(`/servers/${serverId}/events`, {
        method: 'POST',
        body: input,
      });
      return result.event;
    },
    onSuccess: (event) => {
      queryClient.setQueryData<EventWithMeta[]>(qk.events.byServer(serverId), (prev) => {
        const list = prev ?? [];
        return [...list, event];
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.events.byServer(serverId) });
    },
  });
}

export function useUpdateEvent(
  serverId: string,
): UseMutationResult<EventWithMeta, ApiError, { eventId: string; patch: UpdateEventDto }> {
  const queryClient = useQueryClient();
  return useMutation<EventWithMeta, ApiError, { eventId: string; patch: UpdateEventDto }>({
    mutationFn: async ({ eventId, patch }) => {
      const result = await api<EventEnvelope>(`/events/${eventId}`, {
        method: 'PATCH',
        body: patch,
      });
      return result.event;
    },
    onSuccess: (event) => {
      queryClient.setQueryData<EventWithMeta[]>(qk.events.byServer(serverId), (prev) => {
        const list = prev ?? [];
        return list.map((item) => (item.id === event.id ? event : item));
      });
    },
    onSettled: (event) => {
      if (event) {
        void queryClient.invalidateQueries({ queryKey: qk.events.byServer(serverId) });
        void queryClient.invalidateQueries({ queryKey: qk.events.byId(event.id) });
      }
    },
  });
}

export function useDeleteEvent(
  serverId: string,
): UseMutationResult<{ deleted: boolean }, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: boolean }, ApiError, string>({
    mutationFn: async (eventId) => {
      return api<{ deleted: boolean }>(`/events/${eventId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, eventId) => {
      queryClient.setQueryData<EventWithMeta[]>(qk.events.byServer(serverId), (prev) => {
        const list = prev ?? [];
        return list.filter((item) => item.id !== eventId);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.events.byServer(serverId) });
    },
  });
}

export function useUpsertRsvp(
  serverId: string,
): UseMutationResult<{ success: boolean }, ApiError, { eventId: string; status: RsvpStatus }> {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, ApiError, { eventId: string; status: RsvpStatus }>({
    mutationFn: async ({ eventId, status }) => {
      return api<{ success: boolean }>(`/events/${eventId}/rsvp`, {
        method: 'POST',
        body: { status },
      });
    },
    onSettled: (_, __, { eventId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.events.byServer(serverId) });
      void queryClient.invalidateQueries({ queryKey: qk.events.byId(eventId) });
    },
  });
}
