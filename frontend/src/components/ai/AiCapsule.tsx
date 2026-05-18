import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import {
  ISLAND_BACKDROP_FADE,
  ISLAND_SHAPE_STYLE,
  ISLAND_SHELL_SPRING,
} from '@/components/island/animations';
import { useIslandStore } from '@/components/island/useIslandStore';
import { useMusicShellWidth } from '@/components/music/useMusicShellWidth';
import { cn } from '@/lib/cn';

import { AI_SHAPES, type AiView } from './aiCapsuleShapes';
import { AiExpandedSlot } from './AiExpandedSlot';
import { AiIdleSlot } from './AiIdleSlot';
import { AiInlineCalendarView } from './AiInlineCalendarView';
import { AiInlineNoteView } from './AiInlineNoteView';
import { useAiCapsuleStore } from './useAiCapsuleStore';
import { Slot } from './AiCapsuleSlot';

/**
 * The AI capsule. Sibling of `MusicCapsule` — same shell mechanics,
 * same animation primitives, but its own state and slot set.
 *
 * Two views:
 *   - `idle`     → 26×26 logo dot. Click to expand.
 *   - `expanded` → 420×300 ask card with composer + streaming
 *                  response + source chips.
 *
 * The capsule hides when the Dynamic Island is expanded (they share
 * z-50 airspace) and unmounts SSR-side by deferring portal mount
 * until after first render.
 */
// Music shell sits at right-[224px]. The AI capsule sits 8px to the left
// of music's left edge, so its right offset = 224 + musicWidth + 8.
const MUSIC_SHELL_RIGHT = 224;
const CAPSULE_GAP = 8;

export function AiCapsule(): React.JSX.Element | null {
  const reducedMotion = useReducedMotion();

  const expanded = useAiCapsuleStore((s) => s.expanded);
  const openSource = useAiCapsuleStore((s) => s.openSource);
  const open = useAiCapsuleStore((s) => s.open);
  const close = useAiCapsuleStore((s) => s.close);
  const closeSourcePane = useAiCapsuleStore((s) => s.closeSourcePane);

  const islandExpanded = useIslandStore((s) => s.expandedTo !== null);
  const musicWidth = useMusicShellWidth();
  const rightOffset = MUSIC_SHELL_RIGHT + musicWidth + CAPSULE_GAP;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, close]);

  // Close the capsule whenever the URL pathname changes. Drives
  // "click a tool-result chip that navigates → island collapses"
  // plus any other in-app navigation (sidebar links, back/forward).
  // Effect also fires on mount, which is desired: a fresh page load
  // should land with the capsule closed regardless of any persisted
  // store state. `close()` also clears the source pane.
  const { pathname } = useLocation();
  useEffect(() => {
    close();
  }, [pathname, close]);

  if (!mounted) return null;
  if (islandExpanded) return null;

  const view: AiView = !expanded
    ? 'idle'
    : openSource !== null
      ? 'expanded-with-source'
      : 'expanded';
  const shape = AI_SHAPES[view];

  return createPortal(
    <>
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="ai-backdrop"
            variants={ISLAND_BACKDROP_FADE}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={close}
            className="fixed inset-0 z-50 backdrop-blur-md"
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        data-ai-shell
        role={expanded ? 'dialog' : 'button'}
        aria-haspopup={expanded ? undefined : 'dialog'}
        aria-expanded={expanded}
        aria-label={expanded ? 'Personal AI' : 'Open AI assistant'}
        tabIndex={expanded ? -1 : 0}
        onClick={expanded ? undefined : open}
        onKeyDown={
          expanded
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open();
                }
              }
        }
        initial={false}
        animate={{ width: shape.width, height: shape.height, right: rightOffset }}
        style={{
          ...ISLAND_SHAPE_STYLE,
          backgroundColor: '#0A0A0C',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06) inset, 0 12px 32px -8px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.5)',
        }}
        transition={reducedMotion ? { duration: 0 } : ISLAND_SHELL_SPRING}
        className={cn(
          // Sits 8px to the left of the music capsule. The right offset
          // is animated above (driven by `useMusicShellWidth`) so the AI
          // capsule slides out of the way as the music shell morphs
          // through idle (26) → bar (240) → expanded (380+).
          'fixed top-[4.5px]',
          expanded ? 'z-50' : 'z-30',
          'text-ink',
          'overflow-hidden',
          shape.radiusClass,
          !expanded && 'cursor-pointer',
          'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {view === 'idle' ? (
            <Slot key="idle" shape={shape}>
              <AiIdleSlot />
            </Slot>
          ) : view === 'expanded' ? (
            <Slot key="expanded" shape={shape}>
              <AiExpandedSlot onClose={close} />
            </Slot>
          ) : (
            <Slot key="expanded-with-source" shape={shape}>
              <div className="flex h-full w-full gap-3">
                {/* Chat column fixed at 360px so the source pane on */}
                {/* the right (calendar, note viewer) gets the bulk of */}
                {/* the morphed width — the calendar grid reads much */}
                {/* better with breathing room than the chat does. */}
                <div className="w-[360px] shrink-0">
                  <AiExpandedSlot onClose={close} />
                </div>
                <div className="bg-glass-surface-2 border-glass-border min-w-0 flex-1 rounded-2xl border p-3">
                  {openSource?.kind === 'note' ? (
                    <AiInlineNoteView
                      channelId={openSource.id}
                      title={openSource.title}
                      onClose={closeSourcePane}
                    />
                  ) : openSource?.kind === 'event' ? (
                    <AiInlineCalendarView
                      title={openSource.title}
                      startAt={openSource.startAt}
                      onClose={closeSourcePane}
                    />
                  ) : null}
                </div>
              </div>
            </Slot>
          )}
        </AnimatePresence>
      </motion.div>
    </>,
    document.body,
  );
}
