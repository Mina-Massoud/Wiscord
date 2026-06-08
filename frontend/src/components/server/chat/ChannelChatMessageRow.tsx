import { getIdenticonDataUrl } from '@/lib/avatar';
import { formatMessageTime } from '@/lib/date';
import { MediaImg } from '@/components/ui/media-img';
import { cn } from '@/lib/cn';
import type { MessageDto } from '@/types/message';
import { ChatMessageMarkdown } from '@/components/chat/ChatMessageMarkdown';

interface ChannelChatMessageRowProps {
  message: MessageDto;
  isOwn: boolean;
}

export function ChannelChatMessageRow({
  message,
  isOwn,
}: ChannelChatMessageRowProps): React.JSX.Element {
  if (message.deletedAt) {
    return (
      <div className={cn('flex gap-3 px-4 py-1.5 opacity-60', isOwn && 'flex-row-reverse')}>
        <div className="w-10 shrink-0" />
        <div className="text-ink-muted text-body italic">
          [message deleted]
        </div>
      </div>
    );
  }

  const authorName = message.author?.displayName || message.author?.username || 'Unknown';
  const avatarUrl = message.author?.avatarUrl || getIdenticonDataUrl(message.authorId);

  return (
    <div
      data-message-id={message.id}
      id={`message-${message.id}`}
      className={cn(
        'hover:bg-surface-hover/60 group flex gap-3 rounded-md px-4 py-1.5 transition-colors',
        isOwn && 'flex-row-reverse justify-start bg-surface-hover/40',
      )}
    >
      <MediaImg
        src={avatarUrl}
        alt=""
        width={40}
        height={40}
        className="mt-0.5 size-10 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
      <div className={cn('min-w-0 flex-1 flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        <div className={cn('flex items-baseline gap-2', isOwn && 'flex-row-reverse')}>
          <span className="text-ink text-control font-semibold">{authorName}</span>
          <time
            dateTime={message.createdAt}
            className="text-ink-subtle text-badge opacity-0 transition-opacity group-hover:opacity-100"
          >
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
        <div
          className={cn(
            'text-ink text-body mt-1 break-words rounded-2xl px-4 py-2 shadow-sm text-left border',
            isOwn
              ? 'bg-blurple/15 border-blurple/30 rounded-tr-none'
              : 'bg-glass-surface-1 border-glass-border rounded-tl-none',
          )}
        >
          <ChatMessageMarkdown content={message.content} mentions={message.mentions} />
        </div>
      </div>
    </div>
  );
}
