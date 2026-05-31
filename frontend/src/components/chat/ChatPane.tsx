
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useChannelSocket } from '@/hooks/useChannelSocket';

interface ChatPaneProps {
  channelId: string;
}

export function ChatPane({ channelId }: ChatPaneProps) {
  // Setup real-time socket listeners for this channel
  useChannelSocket(channelId);
  const { typingUsers } = useTypingIndicator(channelId);

  const usernames = typingUsers.map((u) => u.username);

  return (
    <div className="flex flex-col h-full bg-glass-surface-1 border-l border-glass-border">
      <div className="h-12 border-b border-glass-border flex items-center px-4 flex-shrink-0 bg-glass-surface-chrome backdrop-blur-md">
        <h2 className="font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-muted-foreground text-lg font-light leading-none">#</span>
          chat-playground
        </h2>
      </div>
      
      <ChatMessageList channelId={channelId} />
      
      <div className="flex-shrink-0 mt-auto">
        <div className="h-6 -mt-6 z-10 relative pointer-events-none">
          <TypingIndicator usernames={usernames} />
        </div>
        <ChatComposer channelId={channelId} />
      </div>
    </div>
  );
}
