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

  const store = useSync({ uri, assets: WHITEBOARD_ASSET_STORE });
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
 * v1 whiteboards don't accept image uploads — keep the canvas focused
 * on pen / shapes / text / sticky. If the user pastes or drops an image
 * tldraw calls `upload`, we reject it loudly so the editor's own toast
 * surfaces the reason instead of failing silently with a broken asset.
 */
const WHITEBOARD_ASSET_STORE: TLAssetStore = {
  upload: () => {
    throw new Error('Images aren’t supported on whiteboards yet.');
  },
  resolve: (asset) => {
    // Default behavior: use whatever src already lives on the asset.
    // Without `upload` succeeding this only fires for assets that came
    // pre-attached to the snapshot — none in v1, but harmless.
    const src = (asset.props as { src?: unknown }).src;
    return typeof src === 'string' ? src : null;
  },
};

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
