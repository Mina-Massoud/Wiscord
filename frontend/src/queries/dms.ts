import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, getSocket } from './client';
import { qk } from './keys';

export interface DmRecipientDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface DmRoomDto {
  id: string;
  recipient: DmRecipientDto;
  unreadCount?: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAuthorId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DmRoomsEnvelope {
  rooms: DmRoomDto[];
}

interface DmRoomEnvelope {
  room: DmRoomDto;
}

export function useDms(): UseQueryResult<DmRoomDto[], ApiError> {
  return useQuery<DmRoomDto[], ApiError>({
    queryKey: qk.dms.list(),
    queryFn: async () => {
      const result = await api<DmRoomsEnvelope>('/dms');
      return result.rooms;
    },
    staleTime: 5000,
  });
}

export function useDmRoom(dmRoomId: string): UseQueryResult<DmRoomDto, ApiError> {
  return useQuery<DmRoomDto, ApiError>({
    queryKey: qk.dms.byId(dmRoomId),
    queryFn: async () => {
      const result = await api<DmRoomEnvelope>(`/dms/${dmRoomId}`);
      return result.room;
    },
    enabled: !!dmRoomId,
  });
}

export function useCreateDmRoom(): UseMutationResult<
  DmRoomDto,
  ApiError,
  { recipientId: string }
> {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation<DmRoomDto, ApiError, { recipientId: string }>({
    mutationFn: async ({ recipientId }) => {
      const result = await api<DmRoomEnvelope>('/dms', {
        method: 'POST',
        body: { recipientId },
      });
      return result.room;
    },
    onSuccess: (room) => {
      void qc.invalidateQueries({ queryKey: qk.dms.list() });
      void navigate(`/app/dms/${room.id}`);
    },
  });
}

export function useMarkDmRead(): UseMutationResult<
  { success: boolean },
  ApiError,
  { dmRoomId: string }
> {
  const qc = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, { dmRoomId: string }>({
    mutationFn: async ({ dmRoomId }) => {
      return await api<{ success: boolean }>(`/dms/${dmRoomId}/read`, {
        method: 'POST',
      });
    },
    onSuccess: (_data, variables) => {
      // Refresh list to recalculate unread counts
      void qc.invalidateQueries({ queryKey: qk.dms.list() });
      void qc.invalidateQueries({ queryKey: qk.dms.byId(variables.dmRoomId) });
    },
  });
}

export function useDmRealtime(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onRoomUpdated = (room: DmRoomDto) => {
      qc.setQueryData<DmRoomDto[]>(qk.dms.list(), (rooms) => {
        if (!rooms) return rooms;
        const withoutUpdated = rooms.filter((existing) => existing.id !== room.id);
        return [room, ...withoutUpdated].sort((a, b) => {
          const timeA = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
          const timeB = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
          return timeB - timeA;
        });
      });
      qc.setQueryData(qk.dms.byId(room.id), room);
      void qc.invalidateQueries({ queryKey: qk.dms.list() });
    };

    socket.on('dm_room:updated', onRoomUpdated);

    return () => {
      socket.off('dm_room:updated', onRoomUpdated);
    };
  }, [qc]);
}
