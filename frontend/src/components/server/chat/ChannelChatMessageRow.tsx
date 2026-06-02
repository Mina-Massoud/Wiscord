import { getIdenticonDataUrl } from '@/lib/avatar';
import { formatMessageTime } from '@/lib/date';
import type { ChannelChatMessage } from '@/lib/channel-chat-store';
import { MediaImg } from '@/components/ui/media-img';
import { cn } from '@/lib/cn';

interface ChannelChatMessageRowProps {
  message: ChannelChatMessage;
  isOwn: boolean;
}

export function ChannelChatMessageRow({
  message,
  isOwn,
}: ChannelChatMessageRowProps): React.JSX.Element {
  if (message.kind === 'system') {
    return (
      <div className="flex justify-center py-2">
        <p className="text-ink-subtle text-caption max-w-md text-center">{message.body}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'hover:bg-surface-hover/60 group flex gap-3 rounded-md px-4 py-1.5 transition-colors',
        isOwn && 'bg-surface-hover/40',
      )}
    >
      <MediaImg
        src={getIdenticonDataUrl(message.authorId)}
        alt=""
        width={40}
        height={40}
        className="mt-0.5 size-10 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-ink text-control font-semibold">{message.authorName}</span>
          <time
            dateTime={message.timestamp}
            className="text-ink-subtle text-badge opacity-0 transition-opacity group-hover:opacity-100"
          >
            {formatMessageTime(message.timestamp)}
          </time>
        </div>
        <p className="text-ink text-body mt-0.5 break-words whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
}
