import { cn } from '@/lib/cn';
import { EmojiPicker } from './EmojiPicker';
import { useAddReaction, useRemoveReaction } from '@/queries/messages';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatReactionsProps {
  messageId: string;
  reactions: { emoji: string; userIds: string[] }[];
}

export function ChatReactions({ messageId, reactions }: ChatReactionsProps) {
  const { user } = useAuth();
  const { mutate: addReaction } = useAddReaction();
  const { mutate: removeReaction } = useRemoveReaction();

  const handleSelectEmoji = (emoji: string) => {
    const existingReaction = reactions.find((r) => user && r.userIds.includes(user.id));

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        removeReaction({ messageId, emoji });
        return;
      }
      removeReaction({ messageId, emoji: existingReaction.emoji });
    }
    addReaction({ messageId, emoji });
  };

  const handleToggleReaction = (emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      removeReaction({ messageId, emoji });
    } else {
      const existingReaction = reactions.find((r) => user && r.userIds.includes(user.id));
      if (existingReaction) {
        removeReaction({ messageId, emoji: existingReaction.emoji });
      }
      addReaction({ messageId, emoji });
    }
  };

  if (reactions.length === 0) {
    return (
      <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <EmojiPicker onSelect={handleSelectEmoji} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1 relative">
      <TooltipProvider delayDuration={400}>
        {reactions.map((reaction) => {
          const hasReacted = user ? reaction.userIds.includes(user.id) : false;
          const whoReactedText = reaction.userIds.map(id => id === user?.id ? user.username : 'User').join(', ');
          return (
            <Tooltip key={reaction.emoji}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleToggleReaction(reaction.emoji, hasReacted)}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-colors",
                    hasReacted 
                      ? "bg-blurple/20 border-blurple/50 text-blurple-foreground" 
                      : "bg-surface-2 border-border hover:border-border-strong text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-medium">{reaction.userIds.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{whoReactedText}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
      
      {!reactions.some((r) => user && r.userIds.includes(user.id)) && (
        <EmojiPicker 
          onSelect={handleSelectEmoji}
          trigger={
            <button className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-surface-2 border border-border hover:border-border-strong text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-xs">+</span>
            </button>
          }
        />
      )}
    </div>
  );
}
