import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/queries/client';
import { qk } from '@/queries/keys';

export interface ServerMemberUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ServerMemberDto {
  id: string;
  serverId: string;
  userId: string;
  role: 'owner' | 'member';
  user: ServerMemberUserDto;
}

interface MembersResponse {
  members: ServerMemberDto[];
}

export function useServerMembers(serverId: string | undefined): UseQueryResult<ServerMemberDto[]> {
  return useQuery<ServerMemberDto[]>({
    queryKey: qk.members.byServer(serverId ?? ''),
    queryFn: async () => {
      const result = await api<MembersResponse>(`/servers/${serverId}/members`);
      return result.members;
    },
    enabled: Boolean(serverId),
    staleTime: 5 * 60 * 1000,
  });
}
