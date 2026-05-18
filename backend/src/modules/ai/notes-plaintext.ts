import * as Y from 'yjs';

import { logger } from '../../lib/logger.js';
import { loadNotesUpdate, NOTES_DOC_FIELD } from '../realtime/notes-persistence.js';

/**
 * Yjs notes → plaintext extraction. Used by both the AI context
 * builder and the inline-note source pane. Lives here (not inside
 * context-builder.ts) so the source-pane endpoint can reuse the
 * exact same decoder without dragging the context-builder's
 * Mongoose queries along.
 *
 * Pure with respect to its inputs — only side effect is reading
 * the persisted Yjs Buffer through `loadNotesUpdate`.
 */

/**
 * Decode a single channel's Yjs notes doc into plaintext. Walks
 * the TipTap XmlFragment and concatenates block-level text nodes
 * with newline separators so paragraphs read naturally.
 *
 * Returns the empty string on missing doc or corrupt payload —
 * callers handle the empty case themselves.
 */
export async function getNotePlaintext(channelId: string): Promise<string> {
  try {
    const update = await loadNotesUpdate(channelId);
    if (!update) return '';
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update, 'ai-notes-plaintext');
    const fragment = doc.getXmlFragment(NOTES_DOC_FIELD);
    return walkXmlFragment(fragment).trim();
  } catch (err) {
    logger.warn({ err, channelId }, 'ai: failed to decode note ydoc; returning empty');
    return '';
  }
}

/**
 * First non-empty line of a note's plaintext, truncated to 40
 * chars. Used as a chip label in place of the raw channelId.
 * Returns null when the doc has no text — callers fall back to a
 * deterministic funny title.
 *
 * Runs the result through `stripMarkupForLabel` as a safety net
 * in case the walker missed a TipTap formatting mark (link, bold,
 * etc.) — chip labels must never leak `<link …>` or similar.
 */
export async function getNoteTitleHint(channelId: string): Promise<string | null> {
  const plaintext = await getNotePlaintext(channelId);
  return titleHintFromPlaintext(plaintext);
}

/**
 * Synchronous variant for callers that already hold the decoded
 * plaintext (e.g. the AI context builder). Avoids the duplicate
 * Mongo round-trip + Yjs decode that calling `getNoteTitleHint`
 * separately would incur.
 */
export function titleHintFromPlaintext(plaintext: string): string | null {
  if (plaintext.length === 0) return null;
  const firstLine = plaintext.split('\n').find((line) => line.trim().length > 0);
  if (!firstLine) return null;
  const cleaned = stripMarkupForLabel(firstLine);
  if (cleaned.length === 0) return null;
  return cleaned.length <= 40 ? cleaned : `${cleaned.slice(0, 39)}…`;
}

/**
 * Belt-and-braces tag stripper for chip labels. Yjs `XmlText`
 * occasionally emits formatting marks (e.g. `link`) in its
 * `toString()` output as XML — `Hello<link class="null" href=…>`
 * is the classic symptom. We pull anything between angle
 * brackets out, collapse whitespace, and call it good.
 */
function stripMarkupForLabel(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Concatenate text content across an XmlFragment, inserting a
 * newline after every block-level element (paragraph / heading /
 * listItem / blockquote / codeBlock) so paragraphs stay separate
 * in the plaintext output.
 *
 * For `Y.XmlText` nodes we read via `.toDelta()` — the delta
 * format is an array of `{ insert: string, attributes?: {…} }`
 * entries, where `insert` is the *raw* string content with no
 * formatting tags. Using `.toString()` would re-serialize the
 * text with its TipTap marks wrapped as XML (e.g. `<link …>foo</link>`),
 * which is what was leaking into chip labels.
 */
function walkXmlFragment(frag: Y.XmlFragment): string {
  const parts: string[] = [];
  const isBlock = (tag: string): boolean =>
    tag === 'paragraph' ||
    tag === 'heading' ||
    tag === 'blockquote' ||
    tag === 'listItem' ||
    tag === 'codeBlock';

  const walk = (item: Y.XmlElement | Y.XmlText | Y.XmlFragment | Y.XmlHook): void => {
    if (item instanceof Y.XmlText) {
      const delta = item.toDelta() as Array<{ insert?: unknown }>;
      for (const op of delta) {
        if (typeof op.insert === 'string') parts.push(op.insert);
      }
      return;
    }
    if (item instanceof Y.XmlElement || item instanceof Y.XmlFragment) {
      item.toArray().forEach(walk);
      if (item instanceof Y.XmlElement && isBlock(item.nodeName)) {
        parts.push('\n');
      }
    }
  };

  frag.toArray().forEach(walk);
  return parts.join('');
}
