import { useEffect, useRef } from 'react';
import { useChannelMessages } from '@/queries/messages';
import { ChatMessage } from './ChatMessage';
import { useAutoAnimate } from '@formkit/auto-animate/react';

interface ChatMessageListProps {
  channelId: string;
}

export function ChatMessageList({ channelId }: ChatMessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useChannelMessages(channelId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  // Sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom on first load or new messages if we were already at bottom
  useEffect(() => {
    if (scrollRef.current) {
      // Reverse infinite scroll means messages are ordered newest-first if we render flex-col-reverse
      // Wait, if we use flex-col-reverse, we don't need to auto-scroll to bottom, the browser handles it natively!
      // The newest message is at the top of the DOM, but visually at the bottom.
      // So we just need to render the pages and messages in reverse.
    }
  }, [data]);

  if (status === 'pending') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-blurple h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center">
        <p>Couldn&apos;t load messages.</p>
        <button onClick={() => fetchNextPage()} className="text-blurple mt-2 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const allMessages = data?.pages.flatMap((page) => page.messages) || [];

  if (allMessages.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="bg-surface-2 mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl">
          👋
        </div>
        <h3 className="text-foreground mb-1 text-lg font-medium">
          Welcome to the beginning of the channel
        </h3>
        <p>This is the start of the chat. Say hi to everyone!</p>
      </div>
    );
  }

  // To group consecutive messages by the same author
  const shouldBeCompact = (index: number) => {
    if (index === allMessages.length - 1) return false;
    const currentMsg = allMessages[index];
    const previousMsg = allMessages[index + 1]; // because array is reversed (newest first)

    // If the message is deleted, don't group it as compact
    if (currentMsg.deletedAt) return false;

    const sameAuthor = currentMsg.authorId === previousMsg.authorId;
    // Assume 5 minutes threshold to break compactness
    const timeDiff =
      new Date(currentMsg.createdAt).getTime() - new Date(previousMsg.createdAt).getTime();
    const withinTimeLimit = timeDiff < 5 * 60 * 1000;

    return sameAuthor && withinTimeLimit;
  };

  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto py-4" ref={scrollRef}>
      <div ref={listRef} className="flex w-full flex-col-reverse">
        {allMessages.map((msg, index) => (
          <ChatMessage key={msg.nonce ?? msg.id} message={msg} isCompact={shouldBeCompact(index)} />
        ))}
      </div>

      <div ref={sentinelRef} className="flex h-4 w-full flex-shrink-0 items-center justify-center">
        {isFetchingNextPage && (
          <div className="border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        )}
      </div>
    </div>
  );
}
