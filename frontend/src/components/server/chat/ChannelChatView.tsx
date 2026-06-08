import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import { useAuth } from '@/hooks/useAuth';
import type { ChannelDto } from '@/queries/channels';
import { useMarkChannelRead } from '@/queries/channels';
import { useChannelMessages, useSendMessage } from '@/queries/messages';
import { useChannelSocket } from '@/hooks/useChannelSocket';
import { useServerMembers } from '@/queries/members';
import type { MessageDto } from '@/types/message';
import { ChannelChatComposer } from './ChannelChatComposer';
import { ChannelChatMessageRow } from './ChannelChatMessageRow';

interface ChannelChatViewProps {
  channel: ChannelDto;
}

export function ChannelChatView({ channel }: ChannelChatViewProps): React.JSX.Element {
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [listParent] = useAutoAnimate<HTMLDivElement>();

  // Fetch messages from backend
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useChannelMessages(channel.id);

  const userId = profile?.id ?? '';
  const { mutate: markChannelRead } = useMarkChannelRead();

  const markCurrentChannelRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    markChannelRead({ serverId: channel.serverId, channelId: channel.id });
  }, [channel.id, channel.serverId, markChannelRead]);

  useEffect(() => {
    if (status !== 'success') return;
    markCurrentChannelRead();
  }, [markCurrentChannelRead, status]);

  useEffect(() => {
    if (status !== 'success') return;

    function handleVisibilityChange(): void {
      markCurrentChannelRead();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [markCurrentChannelRead, status]);

  const handleRealtimeMessageCreated = useCallback(
    (message: MessageDto) => {
      if (message.authorId === userId) return;
      markCurrentChannelRead();
    },
    [markCurrentChannelRead, userId],
  );

  // Real-time updates via Socket.io
  useChannelSocket(channel.id, { onMessageCreated: handleRealtimeMessageCreated });

  // Send message mutation
  const { mutate: sendMessage } = useSendMessage();

  // Fetch server members for autocomplete mentions suggestions
  const { data: members = [] } = useServerMembers(channel.serverId);

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
    sendMessage({ channelId: channel.id, content: body });
  }

  const allMessages = data?.pages.flatMap((page) => page.messages) || [];

  // Highlighting: read `?highlight=<messageId>` and scroll into view + transiently highlight
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    if (!highlightId) return;

    let cancelled = false;

    const tryFindAndHighlight = (): boolean => {
      const el = scrollRef.current?.querySelector(`[data-message-id="${highlightId}"]`) as HTMLElement | null;
      if (!el) return false;
      // Scroll into view within the scroll container
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      // Apply transient highlight classes
      el.classList.add('ring-2', 'ring-yellow-300', 'bg-yellow-200/40');
      // Remove the highlight after 3s
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-yellow-300', 'bg-yellow-200/40');
      }, 3000);
      return true;
    };

    // If message already rendered in DOM, highlight immediately
    if (tryFindAndHighlight()) return;

    // Otherwise, try fetching older pages until found or no more pages
    (async () => {
      while (!cancelled && hasNextPage) {
        try {
          await fetchNextPage();
        } catch (_) {
          break;
        }
        // small delay to allow DOM to update
        await new Promise((r) => setTimeout(r, 50));
        if (tryFindAndHighlight()) return;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, allMessages.length, hasNextPage, status]);

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
            👋
          </div>
          <p className="text-ink text-subhead font-semibold">Welcome to the beginning of #{channel.name}</p>
          <p className="text-ink-muted text-body max-w-sm">
            This is the start of the chat. Say hi to everyone!
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col-reverse overflow-y-auto px-1 py-3"
        >
          <div ref={listParent} className="flex flex-col-reverse w-full">
            {allMessages.map((message) => (
              <ChannelChatMessageRow
                key={message.id}
                message={message}
                isOwn={message.authorId === userId}
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
        channelLabel={channel.name}
        onSend={handleSend}
        members={members}
      />
    </div>
  );
}
