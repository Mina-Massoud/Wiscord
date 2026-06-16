import { useCallback, useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import { useAuth } from '@/hooks/useAuth';
import { useChannelMessages, useSendMessage } from '@/queries/messages';
import { useChannelSocket } from '@/hooks/useChannelSocket';
import { getSocket } from '@/queries/client';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/queries/keys';
import { useMarkDmRead, type DmRoomDto } from '@/queries/dms';
import { isCompactMessage } from '@/lib/messageGrouping';
import { ChannelChatComposer } from '../server/chat/ChannelChatComposer';
import { ChannelChatMessageRow } from '../server/chat/ChannelChatMessageRow';

interface DmChatViewProps {
  room: DmRoomDto;
}

export function DmChatView({ room }: DmChatViewProps): React.JSX.Element {
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [listParent] = useAutoAnimate<HTMLDivElement>();

  const dmRoomId = room.id;
  const userId = profile?.id ?? '';

  // Fetch DM messages from the messages API (reused channel endpoints)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useChannelMessages(dmRoomId);

  // Real-time updates via Socket.io (subscribes to DM room messages)
  useChannelSocket(dmRoomId);

  // Send message mutation
  const { mutate: sendMessage } = useSendMessage();
  const queryClient = useQueryClient();

  // Mark room as read when this DM is active and visible.
  const { mutate: markRead } = useMarkDmRead();

  const markRoomAsRead = useCallback(
    (dmRoomId: string): void => {
      markRead({ dmRoomId });
      queryClient.setQueryData<DmRoomDto[]>(
        qk.dms.list(),
        (rooms) =>
          rooms?.map((room) => (room.id === dmRoomId ? { ...room, unreadCount: 0 } : room)) ??
          rooms,
      );
      queryClient.setQueryData<DmRoomDto>(qk.dms.byId(dmRoomId), (room) =>
        room ? { ...room, unreadCount: 0 } : room,
      );
    },
    [markRead, queryClient],
  );

  useEffect(() => {
    if (!dmRoomId) return;

    const tryMarkRead = () => {
      if (document.visibilityState !== 'visible') return;
      markRoomAsRead(dmRoomId);
    };

    tryMarkRead();
    window.addEventListener('visibilitychange', tryMarkRead);
    return () => window.removeEventListener('visibilitychange', tryMarkRead);
  }, [dmRoomId, markRoomAsRead]);

  useEffect(() => {
    if (!dmRoomId) return;

    const socket = getSocket();
    const onMessageCreated = (message: { channelId: string }) => {
      if (message.channelId !== dmRoomId) return;
      if (document.visibilityState !== 'visible') return;
      markRoomAsRead(dmRoomId);
    };

    socket.on('message:created', onMessageCreated);
    return () => {
      socket.off('message:created', onMessageCreated);
    };
  }, [dmRoomId, markRoomAsRead]);

  // Setup infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function handleSend(body: string): void {
    sendMessage({ channelId: dmRoomId, content: body });
    // Instantly mark as read
    markRoomAsRead(dmRoomId);
  }

  const allMessages = data?.pages.flatMap((page) => page.messages) || [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status === 'pending' ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="border-blurple h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : status === 'error' ? (
        <div className="text-ink-muted text-body flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p>Couldn&apos;t load messages.</p>
          <button onClick={() => void fetchNextPage()} className="text-blurple hover:underline">
            Retry
          </button>
        </div>
      ) : allMessages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="bg-glass-surface-1 mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl">
            💬
          </div>
          <p className="text-ink text-subhead font-semibold">
            This is the start of your direct message history with{' '}
            {room.recipient.displayName || room.recipient.username}
          </p>
          <p className="text-ink-muted text-body max-w-sm">
            Say hello and start studying together!
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex flex-1 flex-col-reverse overflow-y-auto px-1 py-3">
          <div ref={listParent} className="flex w-full flex-col-reverse flex-grow">
            {allMessages.map((message, index) => (
              <ChannelChatMessageRow
                key={message.id}
                message={message}
                isOwn={message.authorId === userId}
                isCompact={isCompactMessage(allMessages, index)}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="flex h-4 w-full shrink-0 items-center justify-center">
            {isFetchingNextPage && (
              <div className="border-ink-muted h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            )}
          </div>
        </div>
      )}

      <ChannelChatComposer
        channelLabel={room.recipient.displayName || room.recipient.username}
        onSend={handleSend}
        members={[]} // No server member autocomplete list in DMs
      />
    </div>
  );
}
