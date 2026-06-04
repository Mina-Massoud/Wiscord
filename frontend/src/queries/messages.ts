import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from './client';
import { qk } from './keys';
import { toast } from '@/lib/toast';
import type { MessageDto } from '@/types/message';

// ── Queries ─────────────────────────────────────────────────────────────────

interface MessagesResponse {
  messages: MessageDto[];
  hasMore: boolean;
}

export function useChannelMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: qk.messages.byChannel(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      return api<MessagesResponse>(`/channels/${channelId}/messages`, {
        search: {
          limit: 50,
          ...(pageParam ? { before: pageParam } : {}),
        },
      });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.messages.length === 0) return undefined;
      // The oldest message is the last in the array since the backend sorts descending
      return lastPage.messages[lastPage.messages.length - 1].createdAt;
    },
    staleTime: 0,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, content }: { channelId: string; content: string }) => {
      return api<MessageDto>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: { content },
      });
    },
    onMutate: async ({ channelId, content }) => {
      await queryClient.cancelQueries({ queryKey: qk.messages.byChannel(channelId) });
      const previousMessages = queryClient.getQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
      );

      // We only insert optimistically if we have previous data
      if (previousMessages) {
        // Create a fake optimistic message
        const optimisticMsg: MessageDto = {
          id: `temp-${Date.now()}`,
          channelId,
          authorId: 'optimistic',
          content,
          mentions: [],
          reactions: [],
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
          qk.messages.byChannel(channelId),
          (old) => {
            if (!old) return old;
            const newPages = [...old.pages];
            // Prepend to the first page (newest messages are at the front)
            if (newPages.length > 0) {
              newPages[0] = {
                ...newPages[0],
                messages: [optimisticMsg, ...newPages[0].messages],
              };
            }
            return { ...old, pages: newPages };
          },
        );
      }

      return { previousMessages };
    },
    onError: (_err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          qk.messages.byChannel(variables.channelId),
          context.previousMessages,
        );
      }
      toast.error("Couldn't send your message. Try again?");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.messages.byChannel(variables.channelId) });
    },
  });
}

// Edit/delete/reaction success updates arrive via the channel socket
// (useChannelSocket patches the cache), so the socket stays the single source
// of truth and we don't double-write here. What was missing is failure
// feedback: without it, a disconnected socket or a 5xx made these silently
// no-op. Each mutation surfaces a friendly error toast on failure.
export function useEditMessage() {
  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      return api<MessageDto>(`/messages/${messageId}`, {
        method: 'PATCH',
        body: { content },
      });
    },
    onError: () => {
      toast.error("Couldn't save your edit. Try again?");
    },
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      return api<{ success: boolean }>(`/messages/${messageId}`, {
        method: 'DELETE',
      });
    },
    onError: () => {
      toast.error("Couldn't delete that message. Try again?");
    },
  });
}

export function useAddReaction() {
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return api<{ success: boolean }>(`/messages/${messageId}/reactions`, {
        method: 'POST',
        body: { emoji },
      });
    },
    onError: () => {
      toast.error("Couldn't add your reaction. Try again?");
    },
  });
}

export function useRemoveReaction() {
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return api<{ success: boolean }>(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        {
          method: 'DELETE',
        },
      );
    },
    onError: () => {
      toast.error("Couldn't remove your reaction. Try again?");
    },
  });
}
