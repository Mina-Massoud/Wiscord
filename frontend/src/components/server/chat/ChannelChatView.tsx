import { useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import { useAuth } from '@/hooks/useAuth';
import { EMPTY_CHANNEL_MESSAGES, useChannelChatStore } from '@/lib/channel-chat-store';
import type { ChannelDto } from '@/queries/channels';
import { ChannelChatComposer } from './ChannelChatComposer';
import { ChannelChatMessageRow } from './ChannelChatMessageRow';

interface ChannelChatViewProps {
  channel: ChannelDto;
}

/**
 * Local-only channel chat UI — messages live in memory until the messages API ships.
 */
export function ChannelChatView({ channel }: ChannelChatViewProps): React.JSX.Element {
  const { profile } = useAuth();
  const messages =
    useChannelChatStore((s) => s.messagesByChannel[channel.id]) ?? EMPTY_CHANNEL_MESSAGES;
  const appendMessage = useChannelChatStore((s) => s.appendMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [listParent] = useAutoAnimate<HTMLDivElement>();

  const userId = profile?.id ?? 'local-user';
  const userName = profile?.display_name ?? profile?.username ?? 'You';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  function handleSend(body: string): void {
    appendMessage(channel.id, {
      authorId: userId,
      authorName: userName,
      body,
      kind: 'message',
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-ink text-subhead font-semibold">No messages yet</p>
            <p className="text-ink-muted text-body max-w-sm">
              Say hi in #{channel.name}. Messages stay on this device until chat sync ships.
            </p>
          </div>
        ) : (
          <div ref={listParent} className="flex flex-col py-3">
            {messages.map((message) => (
              <ChannelChatMessageRow
                key={message.id}
                message={message}
                isOwn={message.authorId === userId && message.kind === 'message'}
              />
            ))}
          </div>
        )}
      </div>

      <ChannelChatComposer channelLabel={channel.name} onSend={handleSend} />
    </div>
  );
}
