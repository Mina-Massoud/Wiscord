import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Pencil } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { funnyTitle } from '@/lib/funny-title';
import { pickCursorColor } from '@/lib/tldraw-theme';
import type { WhiteboardIdentity } from '@/types/whiteboard';

import { AppShellLayout } from '@/components/app-shell/AppShellLayout';
import { AppTitleBar } from '@/components/app-shell/AppTitleBar';
import { ServerRail } from '@/components/app-shell/ServerRail';
import { UserPanel } from '@/components/app-shell/UserPanel';
import { ActiveNowPanel } from '@/components/app-shell/friends/ActiveNowPanel';

import { WhiteboardCanvas } from '@/components/whiteboard/WhiteboardCanvas';
import { WhiteboardFullscreenToggle } from '@/components/whiteboard/WhiteboardFullscreenToggle';
import { WhiteboardLogoMark } from '@/components/whiteboard/WhiteboardLogoMark';

/**
 * Dev-only whiteboard lab mounted at `/app/labs/whiteboard/:channelId`.
 *
 * Mirrors the panel composition of `VoiceLabPage` so the shell rhythm
 * stays consistent across labs. The collaborative canvas is the entire
 * `main` slot; the bottom-center toolbar is rendered inside it as an
 * absolute overlay so it can read the live tldraw editor reference.
 *
 * Identity (display name + deterministic cursor color) is fed into
 * tldraw's presence system from the authed user via `useAuth` — same
 * user, same color across every device and reconnect.
 *
 * When the channels module ships, this page is deleted and
 * `<WhiteboardCanvas>` mounts inside the real channel page's
 * "Whiteboard" tab — no component rewrites needed.
 */
export default function WhiteboardLabPage(): React.JSX.Element {
  const { channelId } = useParams<{ channelId: string }>();
  const { profile } = useAuth();
  const title = useMemo(() => (channelId ? funnyTitle(channelId) : ''), [channelId]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), []);

  // Escape exits focus mode — only listen while we're actually in it so
  // the key still bubbles to tldraw (its own deselect / cancel uses Esc)
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
    // RequireAuth guards above us; this branch is just a defensive
    // skeleton in case the auth query is still hydrating on first paint.
    return (
      <div className="bg-canvas text-ink flex min-h-screen items-center justify-center p-8">
        <p className="text-ink-muted text-body">Loading your profile…</p>
      </div>
    );
  }

  const identity: WhiteboardIdentity = {
    userId: profile.id,
    displayName: profile.display_name ?? profile.username,
    color: pickCursorColor(profile.id),
  };

  // Focus mode — the canvas fills the viewport, hiding every shell
  // panel so the user can think on a clean surface. The toggle button
  // stays anchored top-right in both modes so there's always a way out
  // (Esc also exits, wired above).
  if (isFullscreen) {
    return (
      <div className="bg-canvas fixed inset-0 z-50 flex">
        <WhiteboardCanvas channelId={channelId} identity={identity} />
        <WhiteboardLogoMark />
        <WhiteboardFullscreenToggle isFullscreen onToggle={toggleFullscreen} />
      </div>
    );
  }

  return (
    <AppShellLayout
      titleBar={<AppTitleBar title={`Whiteboard · ${title}`} />}
      serverRail={<ServerRail />}
      userPanel={<UserPanel />}
      topBar={
        <header className="border-glass-border h-app-titlebar flex shrink-0 items-center gap-2 border-b px-4">
          <Pencil className="text-ink-muted size-4 shrink-0" aria-hidden />
          <span className="text-ink text-subhead font-semibold">{title}</span>
        </header>
      }
      main={
        <div className="relative flex min-h-0 flex-1">
          <WhiteboardCanvas channelId={channelId} identity={identity} />
          <WhiteboardLogoMark />
          <WhiteboardFullscreenToggle isFullscreen={false} onToggle={toggleFullscreen} />
        </div>
      }
      rightRail={<ActiveNowPanel />}
    />
  );
}
