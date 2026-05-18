import { defaultMarkdownParser, MarkdownParser } from 'prosemirror-markdown';
import { Schema } from 'prosemirror-model';
import * as Y from 'yjs';
import { prosemirrorToYDoc } from 'y-prosemirror';

import { NOTES_DOC_FIELD } from '../realtime/notes-persistence.js';

/**
 * Markdown → Yjs Y.Doc converter for AI-generated notes.
 *
 * Uses the official `prosemirror-markdown` + `y-prosemirror` pipeline
 * rather than a hand-rolled XmlElement emitter. The hand-rolled
 * version produced node shapes that TipTap silently failed to render
 * (markdown showed up as literal `#` / `-` characters in the editor);
 * routing through a real ProseMirror schema lets `y-prosemirror`'s
 * `prosemirrorToYDoc` build the Yjs CRDT exactly the way the live
 * TipTap editor would have, which is what `ySyncPlugin` expects on
 * read.
 *
 * Schema design: our schema mirrors the SUBSET of TipTap's StarterKit
 * we support, with TipTap's CAMELCASE node names (`bulletList`,
 * `orderedList`, `listItem`, `codeBlock`, `hardBreak`). The default
 * schema shipped by `prosemirror-markdown` uses snake_case from the
 * upstream ProseMirror conventions, which doesn't match TipTap and
 * was the original source of the render breakage. We re-map every
 * markdown-it block token (snake_case) to our camelCase node names
 * via a custom `MarkdownParser` so the parser produces nodes our
 * schema understands.
 *
 * Supported subset (v1):
 *   - Headings (1-6, all levels)
 *   - Paragraphs
 *   - Bullet + ordered lists with list items
 *   - Blockquotes
 *   - Fenced code blocks with optional language
 *   - Hard breaks
 *   - Plain inline text (no marks — bold/italic/links surface as
 *     literal characters)
 */

/**
 * Custom ProseMirror schema with TipTap StarterKit-compatible node
 * names. Kept minimal — just the structures the AI is allowed to
 * emit. Adding marks later is straightforward (extend `marks`); the
 * schema is wide open for it.
 */
/**
 * Schema notes:
 *   - No `parseDOM` / `toDOM` specs — those are needed only for
 *     browser-side rendering (`DOMParser` / `DOMSerializer`). On the
 *     backend we only use the schema to validate the structure the
 *     markdown parser builds and to hand to `prosemirrorToYDoc`,
 *     neither of which touches DOM. Skipping them also keeps the
 *     file Node-pure (`HTMLElement` isn't defined here).
 *   - `attrs.level.default = 1`; the markdown parser overrides it
 *     per token via `getAttrs`.
 *   - `codeBlock` is `marks: ''` + `code: true` so nothing inline
 *     ever lands on a code block (matches TipTap StarterKit).
 */
const noteSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 } },
      defining: true,
    },
    blockquote: { group: 'block', content: 'block+', defining: true },
    codeBlock: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { language: { default: null } },
    },
    bulletList: { group: 'block', content: 'listItem+' },
    orderedList: {
      group: 'block',
      content: 'listItem+',
      attrs: { start: { default: 1 } },
    },
    listItem: { content: 'paragraph block*', defining: true },
    hardBreak: {
      group: 'inline',
      inline: true,
      selectable: false,
    },
    text: { group: 'inline' },
  },
  // No marks in v1. The AI tool description explicitly tells the model
  // to avoid `**bold**` / `*italic*` / `[link](url)`; adding mark
  // support here later is a localized change.
  marks: {},
});

/**
 * Custom markdown parser. Reuses `defaultMarkdownParser`'s underlying
 * markdown-it tokenizer (which handles the actual CommonMark parsing
 * heavy lifting) but maps every token type to OUR schema's camelCase
 * node names instead of the default snake_case ones.
 *
 * Mark token specs (`em`, `strong`, `link`, `code`) are intentionally
 * omitted — our schema has no marks, so any mark token from the
 * tokenizer is silently dropped and the inline text passes through
 * as plain content. This matches the v1 "no inline marks" constraint
 * documented in the tool description.
 */
const noteParser = new MarkdownParser(noteSchema, defaultMarkdownParser.tokenizer, {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: { block: 'listItem' },
  bullet_list: { block: 'bulletList' },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (tok) => ({ start: Number(tok.attrGet('start') ?? 1) }),
  },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }),
  },
  code_block: { block: 'codeBlock', noCloseToken: true },
  fence: {
    block: 'codeBlock',
    getAttrs: (tok) => ({ language: tok.info || null }),
    noCloseToken: true,
  },
  hr: { ignore: true },
  hardbreak: { node: 'hardBreak' },
  image: { ignore: true },
});

/**
 * Convert a markdown string to a Yjs document populated under the
 * canonical `NOTES_DOC_FIELD` fragment that TipTap binds to. The
 * caller persists the returned doc via `persistNotesDoc` and any
 * future `ySyncPlugin` reader (the live editor, our plaintext
 * walker) reads it as if a human typed it through the editor.
 *
 * Empty / parse-failing input falls back to a doc with a single
 * empty paragraph so the editor never opens to a completely empty
 * fragment (which renders as nothing visible and looks broken).
 */
export function markdownToYDoc(markdown: string): Y.Doc {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return emptyNoteDoc();
  }
  const node = noteParser.parse(trimmed);
  if (node === null) {
    return emptyNoteDoc();
  }
  return prosemirrorToYDoc(node, NOTES_DOC_FIELD);
}

function emptyNoteDoc(): Y.Doc {
  const node = noteSchema.nodes.doc.create(
    null,
    noteSchema.nodes.paragraph.create(),
  );
  return prosemirrorToYDoc(node, NOTES_DOC_FIELD);
}
