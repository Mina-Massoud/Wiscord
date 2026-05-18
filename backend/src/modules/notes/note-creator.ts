import { randomUUID } from 'node:crypto';

import { logger } from '../../lib/logger.js';
import { persistNotesDoc } from '../realtime/notes-persistence.js';
import { markdownToYDoc } from './markdown-to-ydoc.js';

/**
 * Create a fresh notes doc from markdown and persist it as a Yjs
 * row in `channel_notes`. Used by the AI `createNote` tool so the
 * model can save plans / summaries / study guides into the user's
 * `/app/labs/notes` list with one tool call.
 *
 * Mints a brand-new `channelId` per note — there's no concept of
 * "append to existing" in v1. Writing `updatedBy: userId` is what
 * makes the new doc show up in `listNotesForEditor({ userId })`,
 * which drives the notes index page; without that field the row
 * exists but is invisible to the user.
 *
 * If the markdown doesn't already lead with an H1, the supplied
 * `title` is prepended as `# Title` so the editor + the notes-index
 * cards have something readable to show. The title-hint extractor
 * already pulls the first non-empty line as the chip label, so
 * making sure that line is the title (not a random first sentence)
 * keeps the labs index tidy.
 */
export async function createNoteFromMarkdown(args: {
  userId: string;
  title: string;
  markdown: string;
}): Promise<{ channelId: string; title: string }> {
  const trimmedTitle = args.title.trim();
  const trimmedBody = args.markdown.trim();
  const hasLeadingHeading = /^#{1,3}\s+\S/.test(trimmedBody);
  const fullMarkdown = hasLeadingHeading || trimmedTitle.length === 0
    ? trimmedBody
    : `# ${trimmedTitle}\n\n${trimmedBody}`;

  const channelId = randomUUID();
  const doc = markdownToYDoc(fullMarkdown);
  await persistNotesDoc({ channelId, doc, updatedBy: args.userId });

  logger.info(
    { channelId, userId: args.userId, titleLength: trimmedTitle.length },
    'ai: createNote persisted new notes doc',
  );

  return { channelId, title: trimmedTitle };
}
