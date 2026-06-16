import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { api, getSocket } from './client';
import type { ApiError } from './client';

export type NotificationType = 'mention' | 'system';

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  serverId: string | null;
  channelId: string | null;
  messageId: string | null;
  fromUserId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsEnvelope {
  notifications: NotificationDto[];
}

export const notificationKeys = {
  list: () => ['notifications', 'list'] as const,
};

export function useNotifications(): UseQueryResult<NotificationDto[], ApiError> {
  return useQuery<NotificationDto[], ApiError>({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const result = await api<NotificationsEnvelope>('/notifications', {
        search: { limit: 30 },
      });
      return result.notifications;
    },
    staleTime: 10_000,
  });
}

export function useMarkNotificationRead(): UseMutationResult<
  NotificationDto,
  ApiError,
  { notificationId: string }
> {
  const qc = useQueryClient();

  return useMutation<NotificationDto, ApiError, { notificationId: string }>({
    mutationFn: async ({ notificationId }) => {
      const result = await api<{ notification: NotificationDto }>(
        `/notifications/${notificationId}/read`,
        { method: 'POST' },
      );
      return result.notification;
    },
    onSuccess: (notification) => {
      qc.setQueryData<NotificationDto[]>(notificationKeys.list(), (rows) =>
        (rows ?? []).map((row) => (row.id === notification.id ? notification : row)),
      );
    },
  });
}

export function useDeleteNotification(): UseMutationResult<
  void,
  ApiError,
  { notificationId: string },
  { previousNotifications: NotificationDto[] | undefined }
> {
  const qc = useQueryClient();

  return useMutation<void, ApiError, { notificationId: string }, { previousNotifications: NotificationDto[] | undefined }>({
    mutationFn: async ({ notificationId }) => {
      await api(`/notifications/${notificationId}`, { method: 'DELETE' });
    },
    onMutate: async ({ notificationId }) => {
      await qc.cancelQueries({ queryKey: notificationKeys.list() });
      const previousNotifications = qc.getQueryData<NotificationDto[]>(notificationKeys.list());
      qc.setQueryData<NotificationDto[]>(notificationKeys.list(), (rows) =>
        (rows ?? []).filter((row) => row.id !== notificationId),
      );
      return { previousNotifications };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotifications) {
        qc.setQueryData(notificationKeys.list(), context.previousNotifications);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

export function useClearReadNotifications(): UseMutationResult<
  { deletedCount: number },
  ApiError,
  void,
  { previousNotifications: NotificationDto[] | undefined }
> {
  const qc = useQueryClient();

  return useMutation<{ deletedCount: number }, ApiError, void, { previousNotifications: NotificationDto[] | undefined }>({
    mutationFn: async () => {
      const result = await api<{ deletedCount: number }>('/notifications/read', { method: 'DELETE' });
      return result;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.list() });
      const previousNotifications = qc.getQueryData<NotificationDto[]>(notificationKeys.list());
      qc.setQueryData<NotificationDto[]>(notificationKeys.list(), (rows) =>
        (rows ?? []).filter((row) => !row.read),
      );
      return { previousNotifications };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousNotifications) {
        qc.setQueryData(notificationKeys.list(), context.previousNotifications);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

export function useNotificationRealtime(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const upsertNotification = (notification: NotificationDto) => {
      qc.setQueryData<NotificationDto[]>(notificationKeys.list(), (rows) => {
        const existing = rows ?? [];
        const withoutCurrent = existing.filter((row) => row.id !== notification.id);
        return [notification, ...withoutCurrent].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
    };

    const handleNotificationDeleted = ({ notificationId }: { notificationId: string }) => {
      qc.setQueryData<NotificationDto[]>(notificationKeys.list(), (rows) =>
        (rows ?? []).filter((row) => row.id !== notificationId),
      );
    };

    const handleReadCleared = () => {
      qc.setQueryData<NotificationDto[]>(notificationKeys.list(), (rows) =>
        (rows ?? []).filter((row) => !row.read),
      );
    };

    socket.on('notification:created', upsertNotification);
    socket.on('notification:updated', upsertNotification);
    socket.on('notification:deleted', handleNotificationDeleted);
    socket.on('notification:read-cleared', handleReadCleared);

    return () => {
      socket.off('notification:created', upsertNotification);
      socket.off('notification:updated', upsertNotification);
      socket.off('notification:deleted', handleNotificationDeleted);
      socket.off('notification:read-cleared', handleReadCleared);
    };
  }, [qc]);
}
