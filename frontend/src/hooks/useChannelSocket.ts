import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { getSocket } from '@/queries/client';
import { qk } from '@/queries/keys';
import type { MessageDto } from '@/types/message';

// We need to define the type for the infinite query data structure
interface MessagesResponse {
  messages: MessageDto[];
  hasMore: boolean;
}

interface UseChannelSocketOptions {
  onMessageCreated?: (message: MessageDto) => void;
}

export function useChannelSocket(channelId: string, options: UseChannelSocketOptions = {}) {
  const queryClient = useQueryClient();
  const { onMessageCreated: onMessageCreatedCallback } = options;

  useEffect(() => {
    const socket = getSocket();

    // Join channel
    socket.emit('channel:join', channelId);

    // Event listeners
    const onMessageCreated = (message: MessageDto) => {
      if (message.channelId !== channelId) return;

      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
        (old) => {
          if (!old) return old;
          const newPages = [...old.pages];
          if (newPages.length > 0) {
            // Remove optimistic message if present, or just prepend
            const filteredMessages = newPages[0].messages.filter(
              (m) => m.id !== `temp-${message.id}` && !m.id.startsWith('temp-')
            );
            
            // Check if we already have this message (in case of race conditions)
            if (!filteredMessages.find((m) => m.id === message.id)) {
              newPages[0] = {
                ...newPages[0],
                messages: [message, ...filteredMessages],
              };
            }
          }
          return { ...old, pages: newPages };
        }
      );
      onMessageCreatedCallback?.(message);
    };

    const onMessageUpdated = (message: MessageDto) => {
      if (message.channelId !== channelId) return;

      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => (m.id === message.id ? message : m)),
            })),
          };
        }
      );
    };

    const onMessageDeleted = ({ messageId }: { messageId: string }) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) =>
                m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m
              ),
            })),
          };
        }
      );
    };

    const onReactionAdded = ({ messageId, emoji, userId }: { messageId: string; emoji: string; userId: string }) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => {
                if (m.id !== messageId) return m;
                const newReactions = [...m.reactions];
                const existing = newReactions.find((r) => r.emoji === emoji);
                if (existing) {
                  if (!existing.userIds.includes(userId)) {
                    existing.userIds.push(userId);
                  }
                } else {
                  newReactions.push({ emoji, userIds: [userId] });
                }
                return { ...m, reactions: newReactions };
              }),
            })),
          };
        }
      );
    };

    const onReactionRemoved = ({ messageId, emoji, userId }: { messageId: string; emoji: string; userId: string }) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        qk.messages.byChannel(channelId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => {
                if (m.id !== messageId) return m;
                const newReactions = m.reactions
                  .map((r) => {
                    if (r.emoji !== emoji) return r;
                    return { ...r, userIds: r.userIds.filter((id) => id !== userId) };
                  })
                  .filter((r) => r.userIds.length > 0);
                return { ...m, reactions: newReactions };
              }),
            })),
          };
        }
      );
    };

    socket.on('message:created', onMessageCreated);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('message:reaction_added', onReactionAdded);
    socket.on('message:reaction_removed', onReactionRemoved);

    return () => {
      socket.off('message:created', onMessageCreated);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('message:reaction_added', onReactionAdded);
      socket.off('message:reaction_removed', onReactionRemoved);
      socket.emit('channel:leave', channelId);
    };
  }, [channelId, onMessageCreatedCallback, queryClient]);
}
