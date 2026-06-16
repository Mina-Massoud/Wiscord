import type { MessageDto } from '@/types/message';

/**
 * Consecutive messages from the same author within this window collapse into a
 * single visual group (avatar + header shown once, following lines compact).
 * Mirrors Discord's ~7-minute grouping, trimmed to 5 for a tighter study chat.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Whether the message at `index` should render compact (no avatar/header)
 * because it continues the previous author's group.
 *
 * Message lists are stored newest-first (rendered in `flex-col-reverse`), so
 * the chronologically *previous* message sits at `index + 1`.
 */
export function isCompactMessage(messages: MessageDto[], index: number): boolean {
  const current = messages[index];
  const previous = messages[index + 1];
  if (!current || !previous) return false;
  if (current.deletedAt || previous.deletedAt) return false;
  if (current.authorId !== previous.authorId) return false;

  const diff = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return diff >= 0 && diff < GROUP_WINDOW_MS;
}
