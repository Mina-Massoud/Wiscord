import { useEffect, useMemo, useState } from 'react';
import {
  DefaultColorStyle,
  DefaultSizeStyle,
  Tldraw,
  type Editor,
  type TLAssetStore,
  type TLComponents,
} from 'tldraw';
import { useSync } from '@tldraw/sync';

import { API_URL } from '@/queries/client';
import { fetchMediaBlobUrl, kindForFile, uploadMediaFile } from '@/queries/media';
import type { WhiteboardIdentity } from '@/types/whiteboard';

import { WhiteboardToolbar } from './WhiteboardToolbar';

import '@/lib/tldraw-theme.css';

interface WhiteboardCanvasProps {
  channelId: string;
  identity: WhiteboardIdentity;
}

/**
 * Collaborative tldraw canvas wrapped in the Wiscord glass theme.
 *
 * Two things happen on mount:
 *   1. `useSync` opens a WebSocket at `/sync/whiteboard/:channelId` on
 *      the same origin as the REST API. The browser sends the
 *      `wiscord_session` cookie with the upgrade; the backend rejects
 *      anything that isn't a valid session.
 *   2. `onMount` captures the Editor reference so the toolbar (rendered
 *      as a sibling, not a child of `<Tldraw>`) can drive `setCurrentTool`,
 *      `undo`, `redo`, and `toImage`.
 *
 * tldraw's stock toolbar/menu/page-strip are suppressed via `components`
 * — every UI surface the user sees comes from our own glass dock.
 */
export function WhiteboardCanvas({
  channelId,
  identity,
}: WhiteboardCanvasProps): React.JSX.Element {
  const uri = useMemo(() => {
    // `VITE_API_URL` is http/https → upgrade in place to ws/wss.
    const wsBase = API_URL.replace(/^http/, 'ws');
    return `${wsBase}/sync/whiteboard/${channelId}`;
  }, [channelId]);

  const assets = useMemo(() => wiscordAssetStore(channelId), [channelId]);
  const store = useSync({ uri, assets });
  const [editor, setEditor] = useState<Editor | null>(null);

  // Push our identity into tldraw's user preferences so the presence
  // cursor pill shows the right name + color. Same call forces the
  // editor into dark mode — otherwise tldraw reads `prefers-color-scheme`
  // and any user on a light-mode OS would see white chrome leaking on
  // our dark glass canvas.
  useEffect(() => {
    if (!editor) return;
    editor.user.updateUserPreferences({
      id: identity.userId,
      name: identity.displayName,
      color: identity.color,
      colorScheme: 'dark',
    });
  }, [editor, identity]);

  // Default new strokes to a light ink + medium size so the first
  // stroke on a fresh canvas is visible against the dark wallpaper.
  // tldraw's default is `'black'` which is invisible on our background.
  // Also flip on grid mode — without it the canvas reads as a blank
  // dark slab, with no spatial reference for the user.
  // Only run once per editor — overriding live would clobber what the
  // user picked from the color swatch.
  useEffect(() => {
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultColorStyle, 'white');
    editor.setStyleForNextShapes(DefaultSizeStyle, 'm');
    editor.updateInstanceState({ isGridMode: true });
  }, [editor]);

  return (
    // `tl-theme__dark` paints tldraw in dark from frame zero — without
    // this, the first render uses the user's OS color scheme (often
    // light) before our `colorScheme: 'dark'` user-pref effect lands,
    // and white chrome flashes across the canvas.
    <div className="wiscord-tldraw tl-theme__dark relative h-full w-full">
      <Tldraw
        store={store}
        onMount={(e: Editor) => setEditor(e)}
        components={HIDDEN_DEFAULT_CHROME}
      />
      {editor ? <WhiteboardToolbar editor={editor} channelId={channelId} /> : null}
    </div>
  );
}

/**
 * Wiscord's asset store wires tldraw's image/video drops into the
 * Telegram-backed `/storage` endpoint.
 *
 * Strategy:
 *   - On `upload`, push bytes to `/storage/upload` and return
 *     `asset:<media-id>` as the durable src. tldraw's URL validator
 *     allow-lists `asset:` as a sentinel scheme for "stored elsewhere;
 *     resolve me at render time" — so we get a portable, non-leaky
 *     persisted src that doesn't hardcode the backend origin.
 *   - On `resolve`, fetch `/storage/:id` (auth-cookied) and turn it into
 *     a same-origin `blob:` URL. We cache the blob URL per media id so
 *     repeated reads (zoom, pan, tldraw re-render) don't re-download.
 *     The cache is module-scoped — fine: tldraw asks for resolution at
 *     most once per asset per session, and the user revisiting later
 *     gets a fresh blob URL anyway.
 *   - On `remove`, free the blob URL. Server-side deletion is best-effort
 *     and deferred (tldraw passes only its internal asset ids, not the
 *     media ids encoded in `src`).
 *
 * Cross-origin trap (the reason we use blob URLs): tldraw renders
 * `<img src="...">` itself, and it doesn't expose a hook to set
 * `crossOrigin="use-credentials"` on the element. Cross-origin `<img>`
 * doesn't send the session cookie by default, which would 401 on every
 * media render in dev. Blob URLs are same-origin to the page, so no
 * credentials are needed at render time — we paid for them once when
 * we fetched the bytes.
 */
const WISCORD_SCHEME = 'asset:';
const blobUrlCache = new Map<string, string>();

function wiscordAssetStore(channelId: string): TLAssetStore {
  return {
    upload: async (_asset, file, signal) => {
      const uploaded = await uploadMediaFile({
        file,
        kind: kindForFile(file),
        channelId,
        ...(signal ? { signal } : {}),
      });
      return { src: `${WISCORD_SCHEME}${uploaded.id}` };
    },
    resolve: async (asset) => {
      const src = (asset.props as { src?: unknown }).src;
      if (typeof src !== 'string') return null;
      if (!src.startsWith(WISCORD_SCHEME)) return src; // external URL (legacy or pasted)

      const id = src.slice(WISCORD_SCHEME.length);
      const cached = blobUrlCache.get(id);
      if (cached) return cached;

      try {
        const blobUrl = await fetchMediaBlobUrl(id);
        blobUrlCache.set(id, blobUrl);
        return blobUrl;
      } catch {
        // Surfacing the failure as `null` lets tldraw render its own
        // broken-asset state instead of throwing inside a render loop.
        return null;
      }
    },
    remove: async (assetIds) => {
      await Promise.all(
        assetIds.map(async (assetId) => {
          // tldraw asset ids look like `asset:<uuid>` — but we keyed the
          // blob cache by our media id, which is encoded in `src`, not
          // the asset id. Best-effort cleanup: revoke any blob URL whose
          // *backing* asset id matches. tldraw will hand us only its
          // internal ids here, so we skip server-side deletes and let
          // the user delete via the API directly when they want to.
          void assetId;
        }),
      );
      // Free every blob URL we've created — cheap, and prevents a slow
      // memory leak across long sessions with many image edits.
      for (const [, url] of blobUrlCache) URL.revokeObjectURL(url);
      blobUrlCache.clear();
    },
  };
}

/**
 * Suppress every tldraw chrome slot we don't want — every component we
 * replace with our own glass dock, every menu we don't need yet, and
 * every overlay panel that would render with tldraw's stock light
 * background. Anything not listed here (`ContextMenu`, in-place text
 * edit popups, selection handles) stays so editor ergonomics work.
 */
const HIDDEN_DEFAULT_CHROME: TLComponents = {
  Toolbar: null,
  StylePanel: null,
  PageMenu: null,
  MainMenu: null,
  MenuPanel: null,
  ActionsMenu: null,
  HelpMenu: null,
  DebugMenu: null,
  DebugPanel: null,
  NavigationPanel: null,
  ZoomMenu: null,
  SharePanel: null,
  TopPanel: null,
  QuickActions: null,
  HelperButtons: null,
  Minimap: null,
  PeopleMenu: null,
  CursorChatBubble: null,
  FollowingIndicator: null,
};
