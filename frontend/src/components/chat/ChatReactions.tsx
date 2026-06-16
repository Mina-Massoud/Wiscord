import { cn } from '@/lib/cn';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { SmilePlus } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MessageReaction } from '@/types/message';

interface ChatReactionsProps {
  channelId: string;
  messageId: string;
  reactions: MessageReaction[];
}

export function ChatReactions({ channelId, messageId, reactions }: ChatReactionsProps) {
  const { toggle, hasReacted, describeReactors } = useMessageReactions(
    channelId,
    messageId,
    reactions,
  );
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  // No chips until the message has reactions — the hover toolbar's picker is
  // how the first reaction gets added, keeping every row's resting height calm.
  if (reactions.length === 0) return null;

  return (
    <div ref={listRef} className="mt-1 flex flex-wrap items-center gap-1">
      <TooltipProvider delayDuration={400}>
        {reactions.map((reaction) => {
          const reacted = hasReacted(reaction);
          return (
            <Tooltip key={reaction.emoji}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggle(reaction.emoji)}
                  aria-pressed={reacted}
                  aria-label={describeReactors(reaction)}
                  className={cn(
                    'text-caption h-6 gap-1 rounded-md border px-1.5 py-0 font-normal',
                    reacted
                      ? 'border-blurple/50 bg-blurple/20 text-ink hover:bg-blurple/30'
                      : 'border-glass-border bg-glass-surface-2 text-ink-muted hover:border-glass-border-strong hover:text-ink',
                  )}
                >
                  <span className="leading-none">{reaction.emoji}</span>
                  <span className="font-medium tabular-nums">{reaction.userIds.length}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-caption">{describeReactors(reaction)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      <EmojiPicker
        onSelect={toggle}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Add reaction"
            className="text-ink-muted hover:text-ink border-glass-border bg-glass-surface-2 hover:border-glass-border-strong h-6 w-6 rounded-md border"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        }
      />
    </div>
  );
}
