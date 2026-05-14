import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';
import type {
  CalendarCategoriesResponse,
  CalendarCategory,
  CalendarCategoryResponse,
  CalendarEvent,
  CalendarEventResponse,
  CalendarEventsResponse,
  CreateCategoryInput,
  CreateEventInput,
  UpdateCategoryInput,
  UpdateEventInput,
} from '@/types/calendar';

/**
 * REST hooks for the calendar module. One hook per endpoint; mutations
 * invalidate the keys they affect on settle. Optimistic write patterns
 * land in Phase 2 alongside the composer.
 *
 * Date-window queries are keyed by the literal ISO strings so two views
 * watching different windows share nothing — invalidating one channel
 * (or "personal") refetches every active window for that scope.
 */

interface RangeArgs {
  from: string;
  to: string;
  channelId: string | null;
  enabled?: boolean;
}

// ── Events: read ──────────────────────────────────────────────────────────

export function useCalendarEvents(args: RangeArgs): UseQueryResult<CalendarEvent[]> {
  return useQuery<CalendarEvent[]>({
    queryKey: qk.calendar.events({ channelId: args.channelId, from: args.from, to: args.to }),
    queryFn: async () => {
      const res = await api<CalendarEventsResponse>('/calendar/events', {
        search: {
          from: args.from,
          to: args.to,
          channelId: args.channelId ?? undefined,
        },
      });
      return res.events;
    },
    enabled: args.enabled !== false,
    staleTime: 30_000,
  });
}

// ── Events: write ─────────────────────────────────────────────────────────

export function useCreateEvent(): UseMutationResult<CalendarEvent, Error, CreateEventInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await api<CalendarEventResponse>('/calendar/events', {
        method: 'POST',
        body,
      });
      return res.event;
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.calendar.eventsRoot(vars.channelId) });
    },
  });
}

export function useUpdateEvent(
  eventId: string,
): UseMutationResult<CalendarEvent, Error, { patch: UpdateEventInput; channelId: string | null }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patch }) => {
      const res = await api<CalendarEventResponse>(`/calendar/events/${eventId}`, {
        method: 'PATCH',
        body: patch,
      });
      return res.event;
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.calendar.eventsRoot(vars.channelId) });
    },
  });
}

export function useDeleteEvent(): UseMutationResult<
  { deleted: true },
  Error,
  { eventId: string; channelId: string | null }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId }) =>
      api<{ deleted: true }>(`/calendar/events/${eventId}`, { method: 'DELETE' }),
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.calendar.eventsRoot(vars.channelId) });
    },
  });
}

// ── Categories: read ──────────────────────────────────────────────────────

export function useCalendarCategories(args: {
  scope: 'user' | 'channel';
  ownerId: string | null;
}): UseQueryResult<CalendarCategory[]> {
  return useQuery<CalendarCategory[]>({
    queryKey: args.ownerId
      ? qk.calendar.categories(args.scope, args.ownerId)
      : qk.calendar.categoriesRoot,
    queryFn: async () => {
      const res = await api<CalendarCategoriesResponse>('/calendar/categories', {
        search: {
          scope: args.scope,
          channelId: args.scope === 'channel' ? args.ownerId! : undefined,
        },
      });
      return res.categories;
    },
    enabled: args.scope === 'user' ? true : Boolean(args.ownerId),
    staleTime: 5 * 60_000,
  });
}

// ── Categories: write ─────────────────────────────────────────────────────

export function useCreateCategory(): UseMutationResult<
  CalendarCategory,
  Error,
  CreateCategoryInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await api<CalendarCategoryResponse>('/calendar/categories', {
        method: 'POST',
        body,
      });
      return res.category;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.calendar.categoriesRoot });
    },
  });
}

export function useUpdateCategory(
  categoryId: string,
): UseMutationResult<CalendarCategory, Error, UpdateCategoryInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch) => {
      const res = await api<CalendarCategoryResponse>(`/calendar/categories/${categoryId}`, {
        method: 'PATCH',
        body: patch,
      });
      return res.category;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.calendar.categoriesRoot });
    },
  });
}

export function useDeleteCategory(): UseMutationResult<{ deleted: true }, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId) =>
      api<{ deleted: true }>(`/calendar/categories/${categoryId}`, { method: 'DELETE' }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.calendar.categoriesRoot });
    },
  });
}
