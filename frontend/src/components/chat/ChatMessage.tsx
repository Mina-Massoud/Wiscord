import React, { useState } from 'react';
import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';
import { ChatReactions } from './ChatReactions';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteMessage, useEditMessage } from '@/queries/messages';
import type { MessageAuthor, MessageDto } from '@/types/message';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
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

export function ChatMessage({ message, isCompact }: ChatMessageProps) {
  const { user } = useAuth();
  const isAuthor = user?.id === message.authorId || user?.id === message.author?.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const { mutate: editMessage } = useEditMessage();
  const { mutate: deleteMessage } = useDeleteMessage();

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== message.content) {
      editMessage({ messageId: message.id, content: editContent.trim() });
    }
    setIsEditing(false);
  };

  // The API sometimes returns `authorId` populated as an object and sometimes as
  // a raw id string (plus a separate `author`). Narrow without `any` until the
  // backend DTO is unified (toMessageDto follow-up).
  const rawAuthorId: unknown = message.authorId;
  const backendAuthor =
    rawAuthorId && typeof rawAuthorId === 'object' ? (rawAuthorId as MessageAuthor) : null;
  const authorIdString =
    typeof rawAuthorId === 'string'
      ? rawAuthorId
      : ((rawAuthorId as { id?: string } | null)?.id ?? 'unknown');
  const isOptimistic = authorIdString === 'optimistic';

  const author: MessageAuthor =
    message.author ||
    backendAuthor ||
    (isOptimistic && user
      ? {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        }
      : null) || {
      id: authorIdString,
      username: 'Unknown',
      displayName: null,
      avatarUrl: null,
    };

  const displayName = author.displayName || author.username;
  const avatarInitials = displayName.substring(0, 2).toUpperCase();

  if (message.deletedAt) {
    return (
      <div className={cn('group relative flex gap-4 px-4 py-1 hover:bg-black/5', isCompact ? 'mt-0' : 'mt-4')}>
        {!isCompact && (
          <div className="w-10 h-10 flex-shrink-0 opacity-50">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-surface-2 text-muted-foreground">{avatarInitials}</AvatarFallback>
            </Avatar>
          </div>
        )}
        {isCompact && <div className="w-10 flex-shrink-0" />}
        <div className="flex-1 min-w-0 flex items-center text-sm text-muted-foreground italic">
          [message deleted]
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative flex gap-4 px-4 py-1 hover:bg-black/5', isCompact ? 'mt-0' : 'mt-4')}>
      {/* Actions toolbar */}
      <div className="absolute right-4 top-[-14px] opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="flex items-center bg-glass-surface-2 border border-glass-border rounded-md shadow-sm">
          {isAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none rounded-r-md text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 bg-glass-surface-2 border-glass-border">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteMessage({ messageId: message.id })} className="text-red-500 focus:text-red-500">
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {!isCompact && (
        <div className="w-10 h-10 flex-shrink-0">
          <Avatar className="w-10 h-10 cursor-pointer hover:opacity-90 transition-opacity">
            <AvatarImage src={author.avatarUrl || undefined} />
            <AvatarFallback className="bg-blurple/10 text-blurple font-medium">{avatarInitials}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {isCompact && (
        <div className="w-10 flex-shrink-0 flex justify-center opacity-0 group-hover:opacity-100 items-start pt-1">
          <span className="text-[10px] text-muted-foreground select-none">
            {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(new Date(message.createdAt))}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {!isCompact && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-medium text-[15px] hover:underline cursor-pointer">{displayName}</span>
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(message.createdAt))}
            </span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="mt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[40px] resize-none bg-surface-1 border-border focus-visible:ring-1 focus-visible:ring-blurple"
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
            <div className="text-[11px] text-muted-foreground mt-1">
              escape to <span className="text-blurple cursor-pointer hover:underline" onClick={() => setIsEditing(false)}>cancel</span> • enter to <span className="text-blurple cursor-pointer hover:underline" onClick={handleEditSubmit}>save</span>
            </div>
          </form>
        ) : (
          <div className="text-[15px] text-foreground">
            <ChatMessageMarkdown content={message.content} mentions={message.mentions} />
            {message.editedAt && (
              <span className="text-xs text-muted-foreground ml-1 select-none">(edited)</span>
            )}
          </div>
        )}

        {/* Reactions */}
        <ChatReactions messageId={message.id} reactions={message.reactions} />
      </div>
    </div>
  );
}
