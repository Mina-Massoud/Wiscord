import React, { useState } from 'react';
import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';
import { ChatReactions } from './ChatReactions';
import { EmojiPicker } from './EmojiPicker';
import { useAuth } from '@/hooks/useAuth';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useDeleteMessage, useEditMessage } from '@/queries/messages';
import { formatMessageTime, formatMessageTimestamp } from '@/lib/date';
import type { MessageAuthor, MessageDto } from '@/types/message';
import { MoreHorizontal, Pencil, SmilePlus, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatMessageProps {
  message: MessageDto;
  isCompact?: boolean;
}

export function ChatMessage({ message, isCompact = false }: ChatMessageProps) {
  const { user } = useAuth();
  const isAuthor = user?.id === message.authorId || user?.id === message.author?.id;
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

  const isOptimistic = message.authorId === 'optimistic';

  const author: MessageAuthor = message.author ||
    (isOptimistic && user
      ? {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        }
      : null) || {
      id: message.authorId,
      username: 'Unknown',
      displayName: null,
      avatarUrl: null,
    };

  const displayName = author.displayName || author.username;
  const avatarInitials = displayName.substring(0, 2).toUpperCase();

  if (message.deletedAt) {
    return (
      <div className={cn('group flex px-4 py-0.5', isCompact ? 'mt-0' : 'mt-4 pt-1')}>
        <div className="w-10 flex-shrink-0">
          {!isCompact && (
            <Avatar className="h-10 w-10 opacity-50">
              <AvatarFallback className="bg-surface-2 text-ink-subtle">
                {avatarInitials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="text-ink-subtle text-caption ml-4 flex min-w-0 flex-1 items-center italic">
          message deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group hover:bg-glass-hover relative flex px-4 py-0.5 transition-colors',
        isCompact ? 'mt-0' : 'mt-4 pt-1',
      )}
    >
      {/* Hover toolbar — react is available on every message; edit/delete only for the author */}
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
          {isAuthor && (
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
          {isAuthor && (
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
      <div className="w-10 flex-shrink-0">
        {!isCompact ? (
          <Avatar className="h-10 w-10 cursor-pointer transition-opacity hover:opacity-90">
            <AvatarImage src={author.avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-blurple/10 text-blurple font-medium">
              {avatarInitials}
            </AvatarFallback>
          </Avatar>
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
              {displayName}
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
          <div className="text-ink text-body">
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
