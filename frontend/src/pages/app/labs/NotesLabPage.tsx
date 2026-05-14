import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { FileText } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { funnyTitle } from '@/lib/funny-title';
import { useMyNotes } from '@/queries/notes';
import type { NotesSummary } from '@/types/notes';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { UserPanel } from '@/components/app-shell/UserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { NotesEditor } from '@/components/notes/NotesEditor';
import { NotesFullscreenToggle } from '@/components/notes/NotesFullscreenToggle';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { WhiteboardLogoMark } from '@/components/whiteboard/WhiteboardLogoMark';

/**
 * Dev-only notes lab mounted at `/app/labs/notes/:channelId`.
 *
 * Mirrors the panel composition of `WhiteboardLabPage` so the shell
 * rhythm stays consistent across labs. The collaborative editor is the
 * entire `main` slot and owns its own bubble menu + connection status
 * footer; the page wrapper stays thin.
 *
 * Identity (display name + cursor color) is fed into Yjs awareness from
 * the authed user via `useAuth`.
 *
 * Focus mode mirrors the whiteboard: the editor expands to the full
 * viewport, the AppShellLayout chrome hides, and the fullscreen toggle
 * stays anchored top-right in both modes. Esc exits focus mode (only
 * listened to while we're actually in it, so the key still bubbles to
 * TipTap during normal editing).
 *
 * When the channels module ships, this page is deleted and
 * `<NotesEditor>` mounts inside the real channel page's "Notes" tab —
 * no component rewrites needed.
 */
export default function NotesLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const list = useMyNotes();
  const title = useMemo(() => (channelId ? funnyTitle(channelId) : ''), [channelId]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), []);

  const docs = useMemo<NotesSummary[]>(() => list.data?.docs ?? [], [list.data]);

  const goToDoc = useCallback(
    (target: string): void => {
      navigate(`/app/labs/notes/${target}`);
    },
    [navigate],
  );

  const createDoc = useCallback((): void => {
    goToDoc(crypto.randomUUID());
  }, [goToDoc]);

  // Escape exits focus mode — only listen while we're actually in it so
  // the key still bubbles to TipTap (its own cancel / blur uses Esc)
  // during normal editing.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  if (!channelId) {
    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-8">
        <p className="text-ink-muted text-body">No channel id in URL.</p>
      </div>
    );
  }

  if (!profile) {
    // RequireAuth guards above us; defensive branch in case the auth
    // query is still hydrating on first paint.
    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-8">
        <p className="text-ink-muted text-body">Loading your profile…</p>
      </div>
    );
  }

  const displayName = profile.display_name ?? profile.username;
  const editor = <NotesEditor channelId={channelId} user={{ id: profile.id, displayName }} />;

  // Focus mode — the editor fills the viewport, hiding every shell
  // panel. The toggle stays anchored top-right in both modes so there's
  // always a way out (Esc also exits, wired above).
  //
  // Top padding clears the WhiteboardLogoMark (top-4 left-4, ~28px tall).
  // Without it the wordmark sits on top of the editor's first line — the
  // whiteboard canvas doesn't have this problem because tldraw leaves the
  // top-left corner empty, but the notes editor's content starts there.
  if (isFullscreen) {
    return (
      <div className="bg-canvas fixed inset-0 z-50 flex px-6 pt-16 pb-6">
        {editor}
        <WhiteboardLogoMark />
        <NotesFullscreenToggle isFullscreen onToggle={toggleFullscreen} />
      </div>
    );
  }

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={`Notes · ${title}`} />}
      serverRail={<ServerRail />}
      sidebar={
        <NotesSidebar
          docs={docs}
          isLoading={list.isLoading}
          isError={list.isError}
          activeChannelId={channelId}
          onOpen={goToDoc}
          onCreate={createDoc}
        />
      }
      userPanel={<UserPanel />}
      topBar={
        <header className="border-glass-border h-app-titlebar flex shrink-0 items-center gap-2 border-b px-4">
          <FileText className="text-ink-muted size-4 shrink-0" aria-hidden />
          <span className="text-ink text-subhead font-semibold">{title}</span>
        </header>
      }
      main={
        <div className="relative flex min-h-0 flex-1 p-4">
          {editor}
          <NotesFullscreenToggle isFullscreen={false} onToggle={toggleFullscreen} />
        </div>
      }
      rightRail={<ActiveNowPanel />}
    />
  );
}
