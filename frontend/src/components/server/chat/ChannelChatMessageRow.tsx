import React, { useState } from 'react';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { formatMessageTime, formatMessageTimestamp } from '@/lib/date';
import { MediaImg } from '@/components/ui/media-img';
import { cn } from '@/lib/cn';
import type { MessageDto } from '@/types/message';
import { ChatMessageMarkdown } from '@/components/chat/ChatMessageMarkdown';
import { ChatReactions } from '@/components/chat/ChatReactions';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useDeleteMessage, useEditMessage } from '@/queries/messages';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MoreHorizontal, Pencil, SmilePlus, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChannelChatMessageRowProps {
  message: MessageDto;
  isOwn: boolean;
  isCompact?: boolean;
}

export function ChannelChatMessageRow({
  message,
  isOwn,
  isCompact = false,
}: ChannelChatMessageRowProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const { mutate: editMessage } = useEditMessage();
  const { mutate: deleteMessage } = useDeleteMessage();
  const { toggle: toggleReaction } = useMessageReactions(
    message.channelId,
    message.id,
    message.reactions,
  );

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = editContent.trim();
    if (next && next !== message.content) {
      editMessage({ messageId: message.id, content: next });
    }
    setIsEditing(false);
  };

  const startEditing = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  if (message.deletedAt) {
    return (
      <div
        data-message-id={message.id}
        id={`message-${message.id}`}
        className={cn('flex px-4 py-0.5', isCompact ? 'mt-0' : 'mt-4 pt-1')}
      >
        <div className="w-10 shrink-0" />
        <div className="text-ink-subtle text-caption ml-4 flex min-w-0 flex-1 items-center italic">
          message deleted
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
        'group hover:bg-glass-hover relative flex px-4 py-0.5 transition-colors',
        isCompact ? 'mt-0' : 'mt-4 pt-1',
      )}
    >
      {/* Hover toolbar — react on every message; edit/delete only for the author */}
      <div className="absolute -top-4 right-4 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <div className="bg-glass-surface-2 border-glass-border shadow-card flex items-center gap-0.5 rounded-md border p-0.5">
          <EmojiPicker
            onSelect={toggleReaction}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Add reaction"
                className="text-ink-muted hover:text-ink h-7 w-7 rounded-sm"
              >
                <SmilePlus className="h-4 w-4" />
              </Button>
            }
          />
          {isOwn && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit message"
              onClick={startEditing}
              className="text-ink-muted hover:text-ink h-7 w-7 rounded-sm"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="More actions"
                  className="text-ink-muted hover:text-ink h-7 w-7 rounded-sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-glass-surface-2 border-glass-border w-32"
              >
                <DropdownMenuItem
                  onClick={() => deleteMessage({ messageId: message.id })}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Left gutter: avatar on a group's first message, hover-revealed time on compact rows */}
      <div className="w-10 shrink-0">
        {!isCompact ? (
          <MediaImg
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            className="mt-0.5 size-10 shrink-0 cursor-pointer rounded-full object-cover transition-opacity hover:opacity-90"
            loading="lazy"
          />
        ) : (
          <span className="text-ink-subtle text-badge mt-0.5 hidden justify-end pr-1 select-none group-hover:flex">
            {formatMessageTime(message.createdAt)}
          </span>
        )}
      </div>

      <div className="ml-4 flex min-w-0 flex-1 flex-col">
        {!isCompact && (
          <div className="flex items-baseline gap-2">
            <span className="text-ink text-subhead cursor-pointer font-medium hover:underline">
              {authorName}
            </span>
            <span className="text-ink-subtle text-badge">
              {formatMessageTimestamp(message.createdAt)}
            </span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="mt-1 w-full">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="bg-surface-composer border-border focus-visible:ring-blurple resize-none focus-visible:ring-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit(e);
                }
              }}
            />
            <div className="text-ink-muted text-badge mt-1">
              escape to{' '}
              <Button
                type="button"
                variant="link"
                className="text-blurple text-badge h-auto p-0"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
              >
                cancel
              </Button>{' '}
              • enter to{' '}
              <Button
                type="button"
                variant="link"
                className="text-blurple text-badge h-auto p-0"
                onClick={handleEditSubmit}
              >
                save
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-ink text-body break-words">
            <ChatMessageMarkdown content={message.content} mentions={message.mentions} />
            {message.editedAt && (
              <span className="text-ink-subtle text-badge ml-1 select-none">(edited)</span>
            )}
          </div>
        )}

        <ChatReactions
          channelId={message.channelId}
          messageId={message.id}
          reactions={message.reactions}
        />
      </div>
    </div>
  );
}
