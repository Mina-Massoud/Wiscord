import { useAddReaction, useRemoveReaction } from '@/queries/messages';
import { useAuth } from '@/hooks/useAuth';
import type { MessageReaction } from '@/types/message';

interface UseMessageReactions {
  /** Toggle the current user's reaction for an emoji (add if absent, remove if present). */
  toggle: (emoji: string) => void;
  /** Whether the current user has reacted with this emoji. */
  hasReacted: (reaction: MessageReaction) => boolean;
  /** Human-readable tooltip, e.g. "You and 2 others reacted with 🔥". */
  describeReactors: (reaction: MessageReaction) => string;
}

/**
 * Centralizes message-reaction behavior so the inline chips and the hover
 * toolbar's emoji picker stay identical everywhere. Discord-style: a user may
 * hold several distinct reactions on one message, so toggling an emoji only
 * touches that emoji — never clears the user's other reactions.
 */
export function useMessageReactions(
  channelId: string,
  messageId: string,
  reactions: MessageReaction[],
): UseMessageReactions {
  const { user } = useAuth();
  const { mutate: addReaction } = useAddReaction();
  const { mutate: removeReaction } = useRemoveReaction();

  const hasReacted = (reaction: MessageReaction): boolean =>
    !!user && reaction.userIds.includes(user.id);

  const toggle = (emoji: string): void => {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing && hasReacted(existing)) {
      removeReaction({ channelId, messageId, emoji });
    } else {
      addReaction({ channelId, messageId, emoji });
    }
  };

  const describeReactors = (reaction: MessageReaction): string => {
    const mine = hasReacted(reaction);
    const others = reaction.userIds.filter((id) => id !== user?.id).length;
    if (mine && others === 0) return `You reacted with ${reaction.emoji}`;
    if (mine)
      return `You and ${others} ${others === 1 ? 'other' : 'others'} reacted with ${reaction.emoji}`;
    const total = reaction.userIds.length;
    return `${total} ${total === 1 ? 'person' : 'people'} reacted with ${reaction.emoji}`;
  };

  return { toggle, hasReacted, describeReactors };
}
