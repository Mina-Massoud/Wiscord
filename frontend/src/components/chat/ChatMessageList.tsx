import { useEffect, useRef } from 'react';
import { useChannelMessages } from '@/queries/messages';
import { ChatMessage } from './ChatMessage';
import { useAutoAnimate } from '@formkit/auto-animate/react';

interface ChatMessageListProps {
  channelId: string;
}

export function ChatMessageList({ channelId }: ChatMessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useChannelMessages(channelId);
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
      { threshold: 0.1 }
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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blurple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <p>Couldn't load messages.</p>
        <button onClick={() => fetchNextPage()} className="text-blurple hover:underline mt-2">
          Retry
        </button>
      </div>
    );
  }

  const allMessages = data?.pages.flatMap((page) => page.messages) || [];

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4 text-3xl">
          👋
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Welcome to the beginning of the channel</h3>
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
    const timeDiff = new Date(currentMsg.createdAt).getTime() - new Date(previousMsg.createdAt).getTime();
    const withinTimeLimit = timeDiff < 5 * 60 * 1000;
    
    return sameAuthor && withinTimeLimit;
  };

  return (
    <div
      className="flex-1 overflow-y-auto flex flex-col-reverse py-4"
      ref={scrollRef}
    >
      <div ref={listRef} className="flex flex-col-reverse w-full">
        {allMessages.map((msg, index) => (
          <ChatMessage 
            key={msg.id} 
            message={msg} 
            isCompact={shouldBeCompact(index)} 
          />
        ))}
      </div>
      
      <div ref={sentinelRef} className="h-4 flex-shrink-0 flex items-center justify-center w-full">
        {isFetchingNextPage && (
          <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}
