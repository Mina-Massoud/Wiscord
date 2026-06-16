import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from './client';
import { qk } from './keys';
import { generateObjectId } from '@/lib/objectId';
import { toast } from '@/lib/toast';
import type { MessageDto, MessageReaction } from '@/types/message';
import type { Profile } from '@/types/auth';

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

interface SendMessageVars {
  channelId: string;
  content: string;
  // Minted in `onMutate` (if absent) and sent to the server as `clientId` so
  // the optimistic message and the persisted message share one id — see
  // `generateObjectId`. Optional at the call site; callers never pass it.
  id?: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, content, id }: SendMessageVars) => {
      return api<MessageDto>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: { content, clientId: id },
      });
    },
    onMutate: async (variables: SendMessageVars) => {
      // Mint the id once, on the shared `variables` object, so `mutationFn`
      // (which receives the same reference) sends the same id we render with.
      variables.id ??= generateObjectId();
      const { channelId, content, id } = variables;

      await queryClient.cancelQueries({ queryKey: qk.messages.byChannel(channelId) });
      const previousMessages = queryClient.getQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
      );

      // We only insert optimistically if we have previous data
      if (previousMessages) {
        // Stamp the optimistic message with the real signed-in identity (read
        // from the session cache) so it renders on the correct side immediately
        // — the previous `authorId: 'optimistic'` placeholder never matched the
        // current user, so own messages flashed on the left until the real
        // message arrived and replaced them.
        const me = queryClient.getQueryData<Profile>(qk.auth.session());
        const optimisticMsg: MessageDto = {
          id: id!,
          channelId,
          authorId: me?.id ?? 'optimistic',
          author: me
            ? {
                id: me.id,
                username: me.username,
                displayName: me.display_name,
                avatarUrl: me.avatar_url,
              }
            : undefined,
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

// ── Reactions ─────────────────────────────────────────────────────────────
//
// Reactions update optimistically: clicking a chip or picking an emoji patches
// the cached message instantly, so the UI never waits on the POST/DELETE round
// trip (or the socket echo) before reflecting the change. `onError` rolls the
// snapshot back and toasts. The channel socket remains the source of truth for
// *other* clients and reconciles our own patch idempotently when its event
// lands, so we deliberately don't invalidate here and cause a refetch flicker.

interface ReactionVars {
  channelId: string;
  messageId: string;
  emoji: string;
}

interface ReactionContext {
  previousMessages?: InfiniteData<MessagesResponse>;
}

function patchMessageReactions(
  data: InfiniteData<MessagesResponse> | undefined,
  messageId: string,
  update: (reactions: MessageReaction[]) => MessageReaction[],
): InfiniteData<MessagesResponse> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? { ...message, reactions: update(message.reactions) } : message,
      ),
    })),
  };
}

function useReactionOptimism() {
  const queryClient = useQueryClient();

  const apply = async (
    { channelId, messageId }: ReactionVars,
    update: (reactions: MessageReaction[], userId: string) => MessageReaction[],
  ): Promise<ReactionContext> => {
    const me = queryClient.getQueryData<Profile>(qk.auth.session());
    if (!me?.id) return {};

    const key = qk.messages.byChannel(channelId);
    await queryClient.cancelQueries({ queryKey: key });
    const previousMessages = queryClient.getQueryData<InfiniteData<MessagesResponse>>(key);

    queryClient.setQueryData<InfiniteData<MessagesResponse>>(key, (old) =>
      patchMessageReactions(old, messageId, (reactions) => update(reactions, me.id)),
    );

    return { previousMessages };
  };

  const rollback = (vars: ReactionVars, context: ReactionContext | undefined) => {
    if (context?.previousMessages) {
      queryClient.setQueryData(qk.messages.byChannel(vars.channelId), context.previousMessages);
    }
  };

  return { apply, rollback };
}

export function useAddReaction() {
  const { apply, rollback } = useReactionOptimism();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: ReactionVars) => {
      return api<{ success: boolean }>(`/messages/${messageId}/reactions`, {
        method: 'POST',
        body: { emoji },
      });
    },
    onMutate: (vars) =>
      apply(vars, (reactions, userId) => {
        const existing = reactions.find((r) => r.emoji === vars.emoji);
        if (existing) {
          if (existing.userIds.includes(userId)) return reactions;
          return reactions.map((r) =>
            r.emoji === vars.emoji ? { ...r, userIds: [...r.userIds, userId] } : r,
          );
        }
        return [...reactions, { emoji: vars.emoji, userIds: [userId] }];
      }),
    onError: (_err, vars, context) => {
      rollback(vars, context);
      toast.error("Couldn't add your reaction. Try again?");
    },
  });
}

export function useRemoveReaction() {
  const { apply, rollback } = useReactionOptimism();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: ReactionVars) => {
      return api<{ success: boolean }>(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        {
          method: 'DELETE',
        },
      );
    },
    onMutate: (vars) =>
      apply(vars, (reactions, userId) =>
        reactions
          .map((r) =>
            r.emoji === vars.emoji ? { ...r, userIds: r.userIds.filter((id) => id !== userId) } : r,
          )
          .filter((r) => r.userIds.length > 0),
      ),
    onError: (_err, vars, context) => {
      rollback(vars, context);
      toast.error("Couldn't remove your reaction. Try again?");
    },
  });
}
