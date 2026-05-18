import { useEffect, useMemo, useState } from 'react';
import { WebSocketStatus } from '@hocuspocus/provider';

import './notes-prose.css';
import { pickCursorColor } from '@/lib/tldraw-theme';
import { funnyTitle } from '@/lib/funny-title';
import { toast } from '@/lib/toast';
import { useNotesLastEditedBy, type NotesAwarenessUser } from './useNotesLastEditedBy';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { NotesBubbleMenu } from './NotesBubbleMenu';
import { NotesLastEditedBy } from './NotesLastEditedBy';
import { Button } from '@/components/ui/button';
import type { EditorView } from '@tiptap/pm/view';
import { kindForFile, mediaUrl, uploadMediaFile } from '@/queries/media';
import { NotesEditorSkeleton } from './NotesEditorSkeleton';
import type { YBinding } from './NotesEditor';

interface NotesEditorMountedProps {
  channelId: string;
  binding: YBinding;
  user: { id: string; displayName: string };
}

/**
 * Extract image-typed `File`s from a clipboard `DataTransfer`. We deliberately
 * accept gifs alongside still images — `image/gif` is just an image as far as
 * the editor is concerned and `<img>` plays it natively.
 */
function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== 'file') continue;
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  return out;
}

function filesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'));
}

/**
 * Upload `file`, then dispatch a ProseMirror transaction that inserts an
 * `image` node at `pos` pointing at the new asset's URL. We use the view
 * directly (instead of the TipTap editor handle) so this can run from inside
 * `editorProps.handle*` callbacks where the editor instance isn't in scope.
 *
 * Async cleanup: the upload can outlive the editor mount. `view.isDestroyed`
 * is the right guard — `view.state` survives destruction so dispatching into
 * a stale view silently no-ops, but the toast still resolves nicely.
 */
async function uploadAndInsertImage(
  file: File,
  view: EditorView,
  pos: number,
  channelId: string,
): Promise<void> {
  const loadingId = toast.loading(`Uploading ${file.name}…`);
  try {
    const asset = await uploadMediaFile({
      file,
      kind: kindForFile(file),
      channelId,
    });

    if (view.isDestroyed) {
      toast.dismiss(loadingId);
      return;
    }

    const imageType = view.state.schema.nodes['image'];
    if (!imageType) {
      throw new Error('Image node missing from schema — extension not registered.');
    }
    const node = imageType.create({ src: mediaUrl(asset.id), alt: file.name });
    view.dispatch(view.state.tr.insert(pos, node));

    toast.dismiss(loadingId);
    toast.success('Image added');
  } catch (err) {
    toast.dismiss(loadingId);
    const message = err instanceof Error ? err.message : 'Could not upload image';
    toast.error(message);
  }
}

export function NotesEditorMounted({
  binding,
  user,
  channelId,
}: NotesEditorMountedProps): React.JSX.Element {
  const { doc, provider } = binding;
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.Connecting);
  const userColor = useMemo(() => pickCursorColor(user.id), [user.id]);
  const title = useMemo(() => funnyTitle(channelId), [channelId]);

  // Bridge provider lifecycle into React state for the footer pill.
  // We do NOT gate editor render on `synced` — Yjs is offline-first: the
  // editor renders an empty doc immediately and the persisted state layers
  // in within a few hundred ms. Gating on `synced` is a one-way ratchet
  // that strands the user when the event fires before the listener attaches.
  useEffect(() => {
    const onStatus = ({ status: next }: { status: WebSocketStatus }): void => {
      setStatus(next);
    };
    provider.on('status', onStatus);
    return () => {
      provider.off('status', onStatus);
    };
  }, [provider]);

  // Surface a single toast when the connection dies. Captures only `status`
  // so this fires once per state transition, not on every render.
  useEffect(() => {
    if (status === WebSocketStatus.Disconnected) {
      toast.error("Couldn't reach the notes server. We'll keep trying.");
    }
  }, [status]);

  const awarenessUser: NotesAwarenessUser = useMemo(
    () => ({ id: user.id, name: user.displayName, color: userColor }),
    [user.id, user.displayName, userColor],
  );

  const editor = useEditor(
    {
      extensions: [
        // History is owned by Yjs (the CRDT replays into a fresh client),
        // so the StarterKit UndoRedo extension must be off. StarterKit v3
        // also bundles `Link` by default — disable it here so the
        // standalone Link extension below doesn't collide with a duplicate
        // name registration.
        StarterKit.configure({ undoRedo: false, link: false }),
        Placeholder.configure({
          placeholder: 'Start typing — anyone in the channel sees it live.',
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        }),
        Markdown.configure({
          html: false,
          tightLists: true,
          transformPastedText: true,
          transformCopiedText: true,
        }),
        Image.configure({
          // The rendered `<img>` requests bytes from a cross-origin backend
          // (frontend on 5173, backend on 3001 in dev). Without
          // `crossorigin="use-credentials"` the browser drops the session
          // cookie and the request 401s. Pair with the backend CORS allow-
          // credentials response and same-origin in prod just works.
          HTMLAttributes: { crossorigin: 'use-credentials', class: 'notes-image' },
          inline: false,
          allowBase64: false,
        }),
        Collaboration.configure({ document: doc }),
        CollaborationCaret.configure({
          provider,
          user: { name: user.displayName, color: userColor },
        }),
      ],
      editorProps: {
        attributes: {
          // Generous reading column — capped at ~720px so lines stay
          // comfortable to read on wide displays. Vertical breathing room
          // so the cursor + placeholder sit in a real document, not a
          // cramped textbox.
          class:
            'notes-prose focus:outline-none mx-auto w-full max-w-[720px] min-h-[60vh] px-6 sm:px-10 py-10',
          spellcheck: 'false',
        },
        handlePaste: (view, event) => {
          const files = filesFromClipboard(event.clipboardData);
          if (files.length === 0) return false;
          event.preventDefault();
          for (const file of files) {
            void uploadAndInsertImage(file, view, view.state.selection.from, channelId);
          }
          return true;
        },
        handleDrop: (view, event) => {
          // `event` here is a generic Event — narrow to DragEvent for `dataTransfer`.
          const drag = event as DragEvent;
          const files = filesFromDataTransfer(drag.dataTransfer);
          if (files.length === 0) return false;
          drag.preventDefault();
          const coords = view.posAtCoords({ left: drag.clientX, top: drag.clientY });
          const pos = coords?.pos ?? view.state.selection.from;
          for (const file of files) {
            void uploadAndInsertImage(file, view, pos, channelId);
          }
          return true;
        },
      },
      // No `content` — the Y.Doc is the source of truth. Setting initial
      // content here would race the load-from-server update and clobber it.
    },
    // Editor recreated when the underlying doc/provider change so the
    // Collaboration / CollaborationCaret extensions re-bind cleanly.
    [doc, provider, user.displayName, userColor],
  );

  // Push our awareness identity so other clients see name + cursor color.
  useEffect(() => {
    if (!editor) return;
    provider.setAwarenessField('user', awarenessUser);
  }, [editor, provider, awarenessUser]);

  const lastEditedBy = useNotesLastEditedBy(
    provider.awareness ?? null,
    provider.awareness?.clientID ?? null,
  );

  // TipTap's editor is a mutable instance — `editor.isEmpty` flips silently
  // as content changes and React never re-renders without an explicit
  // subscription. Bridge `isEmpty` into state via the `update` event so the
  // empty-state overlay hides as soon as the user types a character (or a
  // Yjs sync update lands content from the server / a peer).
  const [isEmpty, setIsEmpty] = useState(true);
  useEffect(() => {
    if (!editor) return;
    const sync = (): void => setIsEmpty(editor.isEmpty);
    sync();
    editor.on('update', sync);
    editor.on('transaction', sync);
    return () => {
      editor.off('update', sync);
      editor.off('transaction', sync);
    };
  }, [editor]);

  const connectionStatus: 'connecting' | 'connected' | 'disconnected' =
    status === WebSocketStatus.Connected
      ? 'connected'
      : status === WebSocketStatus.Disconnected
        ? 'disconnected'
        : 'connecting';

  if (!editor) return <NotesEditorSkeleton />;

  // The doc title already lives in the AppShellLayout's topBar and the
  // labs-index sidebar — surface it once, not three times. The editor
  // body is the editor body; the footer is for live presence + hints.
  // See CLAUDE.md "Drop redundant labels".
  void title;

  // The Mobbin references (Strut, mymind, Qatalog, Zoom Notes) treat the
  // document surface as a calm reading page — no bordered glass card
  // boxing the content in, no big empty-state overlay competing with the
  // placeholder. The editor *is* the page; chrome lives at the edges.
  return (
    <div className="bg-glass-canvas relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg">
      <div className="relative flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
        <NotesBubbleMenu editor={editor} />
      </div>

      <footer className="border-glass-border bg-glass-surface-2/40 flex items-center justify-between gap-4 border-t px-6 py-2 backdrop-blur-sm">
        <NotesLastEditedBy state={lastEditedBy} status={connectionStatus} />
        <div className="flex shrink-0 items-center gap-3">
          {!isEmpty || connectionStatus !== 'connected' ? null : (
            <span className="text-ink-subtle text-caption hidden md:inline">
              Markdown · ⌘B · ⌘I · ⌘K for link
            </span>
          )}
          {connectionStatus !== 'connected' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                provider.connect();
              }}
            >
              Reconnect
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
