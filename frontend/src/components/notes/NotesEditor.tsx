import { useEffect, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { API_URL } from '@/queries/client';
import { NotesEditorMounted } from './NotesEditorMounted';
import { NotesEditorSkeleton } from './NotesEditorSkeleton';

export interface NotesEditorProps {
  channelId: string;
  /** Current authenticated user — drives awareness identity. */
  user: { id: string; displayName: string };
}

export interface YBinding {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}

/**
 * Collaborative markdown notes editor for a single channel.
 *
 * Architecture:
 *   - One Y.Doc + HocuspocusProvider per channelId, owned by an effect so
 *     React strict-mode mount/cleanup/remount doesn't strand the editor on
 *     a destroyed provider (which would silently never re-fire `synced`).
 *   - HocuspocusProvider opens a WS to `/sync/notes/:channelId` on the same
 *     origin as the REST API. The `wiscord_session` cookie rides the
 *     upgrade; the backend rejects anything that isn't a valid session.
 *   - TipTap binds to the Y.Doc via `Collaboration` (text sync) and
 *     `CollaborationCaret` (remote cursors). The editor is rendered in an
 *     inner component (`NotesEditorMounted`) that only ever sees a live
 *     binding — the outer component handles the lifecycle.
 *   - Awareness publishes `{ user: { id, name, color } }` so other clients
 *     can render the cursor flag + the "Maya is editing" pill.
 *
 * Persistence is server-side: Hocuspocus debounces a write to MongoDB every
 * 2s (max 10s) — no client-side save logic needed. The Y.Doc is the source
 * of truth; no parallel REST snapshot path can clobber it.
 */
export function NotesEditor({ channelId, user }: NotesEditorProps): React.JSX.Element {
  const [binding, setBinding] = useState<YBinding | null>(null);

  // Own the Y.Doc + provider lifetime here, outside useMemo. useMemo would
  // persist a destroyed provider across React strict-mode remounts: the
  // cleanup destroys provider A, the second mount reads the same memoized
  // A, and the editor sits forever waiting for events from a dead socket.
  useEffect(() => {
    const yDoc = new Y.Doc();
    const wsBase = API_URL.replace(/^http/, 'ws');
    const provider = new HocuspocusProvider({
      url: `${wsBase}/sync/notes/${channelId}`,
      name: `channel:${channelId}:notes`,
      document: yDoc,
      // Pre-handshake auth runs from the cookie in `wiscord_session`; the
      // token field is only present so Hocuspocus doesn't warn about it.
      token: 'cookie',
    });
    setBinding({ doc: yDoc, provider });
    return () => {
      provider.destroy();
      yDoc.destroy();
      setBinding(null);
    };
  }, [channelId]);

  if (!binding) return <NotesEditorSkeleton />;

  return <NotesEditorMounted binding={binding} user={user} channelId={channelId} />;
}

// ---------------------------------------------------------------------------
// Inner editor — always receives a live Y.Doc + provider
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Skeleton — used by both the outer "no binding yet" and the inner
// "binding ready, editor still wiring up" states. Shape-matches the real
// layout so the page doesn't shift when content arrives.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Image upload helpers — used by handlePaste / handleDrop
// ---------------------------------------------------------------------------
