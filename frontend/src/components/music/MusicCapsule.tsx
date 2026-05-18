import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import {
  ISLAND_BACKDROP_FADE,
  ISLAND_SHAPE_STYLE,
  ISLAND_SHELL_SPRING,
} from '@/components/island/animations';
import { useIslandStore } from '@/components/island/useIslandStore';
import { cn } from '@/lib/cn';
import { useListenTogetherStore } from '@/lib/listen-together-store';
import { useMusicPlayerStore } from '@/lib/music-player-store';
import { useIntegrations } from '@/queries/integrations';

import { MUSIC_SHAPES, type MusicView } from './musicCapsuleShapes';
import { HostSessionIndicator } from './HostSessionIndicator';
import { ShareMusicPopover } from './ShareMusicPopover';
import { BarSlot } from './slots/BarSlot';
import { ExpandedNowPlayingSlot } from './slots/ExpandedNowPlayingSlot';
import { ExpandedSearchSlot } from './slots/ExpandedSearchSlot';
import { IdleSlot } from './slots/IdleSlot';
import { InviteIncomingConnectedSlot } from './slots/InviteIncomingConnectedSlot';
import { InviteIncomingDisconnectedSlot } from './slots/InviteIncomingDisconnectedSlot';
import { InviteOutgoingPendingSlot } from './slots/InviteOutgoingPendingSlot';
import { ListenTogetherNowPlayingSlot } from './slots/ListenTogetherNowPlayingSlot';
import { Slot } from './MusicCapsuleSlot';

/**
 * The music capsule. Owns the shell morph and the view resolver; each
 * view is a slot file under `./slots/`.
 *
 * View resolution priority (top wins):
 *   1. incoming invite → invite-incoming-* (gates above music — Alice
 *      needs to see Mina's invite even if she has no music going).
 *   2. active session  → listen-together-now-playing (viewer side) /
 *      expanded-now-playing or bar (host side, since the host already
 *      sees the song they're hosting).
 *   3. outgoing invite → invite-outgoing-pending (bar-height chip).
 *   4. regular music   → idle | bar | expanded-search | expanded-now-playing.
 *
 * The capsule is hidden when (a) the user has no integration AND no
 * incoming invite, or (b) the dynamic island is expanded — they share
 * airspace on z-50.
 */
export function MusicCapsule(): React.JSX.Element | null {
  const { data: integrations } = useIntegrations();
  const reducedMotion = useReducedMotion();

  const view = useMusicPlayerStore((s) => s.view);
  const track = useMusicPlayerStore((s) => s.track);
  const openExpanded = useMusicPlayerStore((s) => s.openExpanded);
  const collapseToBar = useMusicPlayerStore((s) => s.collapseToBar);

  const incomingInvite = useListenTogetherStore((s) => s.incomingInvite);
  const sentInvite = useListenTogetherStore((s) => s.sentInvite);
  const activeSession = useListenTogetherStore((s) => s.activeSession);
  const role = useListenTogetherStore((s) => s.role);

  const islandExpanded = useIslandStore((s) => s.expandedTo !== null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (view !== 'expanded') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') collapseToBar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, collapseToBar]);

  if (!mounted) return null;
  if (islandExpanded) return null;

  const hasIntegration = (integrations?.length ?? 0) > 0;
  // The capsule is always present in idle state for authed users — even
  // without an integration. That way an incoming invite morphs from the
  // existing 26px logo dot instead of popping into existence at full
  // pill size. Same physics as every other capsule transition.

  const effectiveView: MusicView = resolveView({
    hasIntegration,
    incomingInvite: incomingInvite !== null,
    activeSession: activeSession !== null,
    sentInvite: sentInvite !== null,
    role,
    hasTrack: track !== null,
    expanded: view === 'expanded',
  });
  const shape = MUSIC_SHAPES[effectiveView];
  const expanded =
    effectiveView === 'expanded-search' ||
    effectiveView === 'expanded-now-playing' ||
    effectiveView === 'listen-together-now-playing';

  return createPortal(
    <>
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="music-backdrop"
            variants={ISLAND_BACKDROP_FADE}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={collapseToBar}
            className="fixed inset-0 z-50 backdrop-blur-md"
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        data-music-shell
        role={expanded ? 'dialog' : 'button'}
        aria-haspopup={expanded ? undefined : 'dialog'}
        aria-expanded={expanded}
        aria-label={expanded ? 'Music player' : 'Open music'}
        // Idle without an integration is a passive placeholder — no
        // expand-to-search affordance because there's no library to
        // search. Stays in the layout so an incoming invite morphs
        // from the same shell instead of popping into existence.
        tabIndex={expanded || !hasIntegration ? -1 : 0}
        onClick={expanded || !hasIntegration ? undefined : openExpanded}
        onKeyDown={
          expanded || !hasIntegration
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openExpanded();
                }
              }
        }
        initial={false}
        animate={{ width: shape.width, height: shape.height }}
        style={{
          ...ISLAND_SHAPE_STYLE,
          backgroundColor: '#0A0A0C',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06) inset, 0 12px 32px -8px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.5)',
        }}
        transition={reducedMotion ? { duration: 0 } : ISLAND_SHELL_SPRING}
        className={cn(
          'fixed top-[4.5px] right-[224px]',
          expanded ? 'z-50' : 'z-30',
          'text-ink',
          'overflow-hidden',
          shape.radiusClass,
          !expanded && hasIntegration && 'cursor-pointer',
          'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {effectiveView === 'invite-incoming-connected' && incomingInvite ? (
            <Slot key="invite-incoming-connected" shape={shape}>
              <InviteIncomingConnectedSlot invite={incomingInvite} />
            </Slot>
          ) : effectiveView === 'invite-incoming-disconnected' && incomingInvite ? (
            <Slot key="invite-incoming-disconnected" shape={shape}>
              <InviteIncomingDisconnectedSlot invite={incomingInvite} />
            </Slot>
          ) : effectiveView === 'listen-together-now-playing' && activeSession ? (
            <Slot key="listen-together-now-playing" shape={shape}>
              <ListenTogetherNowPlayingSlot session={activeSession} />
            </Slot>
          ) : effectiveView === 'invite-outgoing-pending' && sentInvite ? (
            <Slot key="invite-outgoing-pending" shape={shape}>
              <InviteOutgoingPendingSlot invite={sentInvite} />
            </Slot>
          ) : effectiveView === 'idle' ? (
            <Slot key="idle" shape={shape}>
              <IdleSlot />
            </Slot>
          ) : effectiveView === 'bar' && track ? (
            <Slot key="bar" shape={shape}>
              <BarSlot track={track} />
            </Slot>
          ) : effectiveView === 'expanded-search' ? (
            <Slot key="expanded-search" shape={shape}>
              <ExpandedSearchSlot />
            </Slot>
          ) : effectiveView === 'expanded-now-playing' && track ? (
            <Slot key="expanded-now-playing" shape={shape}>
              <ExpandedNowPlayingSlot
                track={track}
                headerActions={
                  activeSession && role === 'host' ? (
                    <HostSessionIndicator session={activeSession} />
                  ) : (
                    <ShareMusicPopover track={track} />
                  )
                }
              />
            </Slot>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </>,
    document.body,
  );
}

interface ResolveViewArgs {
  hasIntegration: boolean;
  incomingInvite: boolean;
  activeSession: boolean;
  sentInvite: boolean;
  role: 'host' | 'viewer' | null;
  hasTrack: boolean;
  expanded: boolean;
}

/**
 * Single function for view resolution. Centralized so the view morph
 * stays predictable — every transition is one transform of this output.
 * Tested directly in `MusicCapsule.test.ts`.
 */
export function resolveView(args: ResolveViewArgs): MusicView {
  if (args.incomingInvite) {
    return args.hasIntegration ? 'invite-incoming-connected' : 'invite-incoming-disconnected';
  }
  if (args.activeSession) {
    // Host stays on the normal expanded-now-playing card — they already
    // see their own song there and can drive playback. Viewer gets the
    // mirrored read-only card when expanded, and a normal bar when
    // collapsed (so they can dismiss the modal-feeling card without
    // ending the session — they keep listening, the bar just gets out
    // of the way).
    if (args.role === 'viewer') {
      return args.expanded ? 'listen-together-now-playing' : 'bar';
    }
    if (args.expanded) return 'expanded-now-playing';
    return 'bar';
  }
  if (args.sentInvite) return 'invite-outgoing-pending';
  if (args.expanded) {
    return args.hasTrack ? 'expanded-now-playing' : 'expanded-search';
  }
  return args.hasTrack ? 'bar' : 'idle';
}

// ─── Slot ────────────────────────────────────────────────────────────────
