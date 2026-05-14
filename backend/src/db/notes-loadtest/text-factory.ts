import * as Y from 'yjs';

/**
 * Yjs / TipTap-compatible content factory for the notes load test.
 *
 * The collaborative notes doc uses TipTap (ProseMirror) bound to a
 * `Y.XmlFragment` named `'default'`. To make our fake participants
 * visible on the host's editor, we have to insert valid ProseMirror
 * node shapes — a `Y.XmlElement('paragraph')` whose only child is a
 * `Y.XmlText` carrying the line. Other shapes (raw `Y.Text` writes,
 * `Y.Map` entries) sync over the wire but TipTap doesn't render them,
 * which would defeat the demo.
 */

const SAMPLE_LINES: readonly string[] = [
  'Working on the load test demo.',
  'Adding more notes here.',
  'Linear with a heartbeat.',
  'Pomodoro starting in 5 minutes.',
  'Drop your prep questions below.',
  'Reviewing chapter 4 — ping me if stuck.',
  'Anyone tried the new pull request flow?',
  'Quick check-in: how is everyone doing?',
  'Posting the homework link in a sec.',
  'Wiscord makes study sessions feel alive.',
  'Highkey vibing with this CRDT setup.',
  'Adding a quick TODO for tomorrow.',
];

function randomLine(prefix: string): string {
  const tail = SAMPLE_LINES[Math.floor(Math.random() * SAMPLE_LINES.length)] ?? 'note';
  return `${prefix} · ${tail}`;
}

/**
 * Append a paragraph with `[displayName] · <text>` to the doc's
 * `default` XmlFragment. Returns the number of characters added.
 *
 * `Y.XmlElement('paragraph')` + `Y.XmlText` is the wire shape
 * `y-prosemirror` emits when TipTap commits a typed paragraph; the
 * host's editor re-renders the new node without any custom handling.
 */
export function appendParagraph(doc: Y.Doc, displayName: string): number {
  const fragment = doc.getXmlFragment('default');
  const line = randomLine(displayName);

  const paragraph = new Y.XmlElement('paragraph');
  const text = new Y.XmlText();
  text.insert(0, line);
  paragraph.insert(0, [text]);

  // `transact` batches the insert into a single update so awareness +
  // content arrive together; otherwise the host sees the paragraph
  // appear, then a cursor jump frame later.
  doc.transact(() => {
    fragment.insert(fragment.length, [paragraph]);
  });

  return line.length;
}
