import { X, ArrowUp, Trash2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useAskAi } from '@/queries/ai';

import { ShimmerText } from './ShimmerText';
import { MessageBubble } from './AiExpandedSlotMessageBubble';
import { SuggestionRail } from './AiExpandedSlotSuggestionRail';
import { FadeSwap } from './AiExpandedSlotFadeSwap';

interface AiExpandedSlotProps {
  onClose: () => void;
}

/**
 * Expanded AI ask card. Layout:
 *   row 1   logo + "Personal AI" chip                    · close ×
 *   row 2   streaming response area (scrollable, aria-live)
 *   row 3   citation chips for sources used in the answer
 *   row 4   composer (input + send button)
 *
 * The hook (`useAskAi`) handles the SSE stream + AbortController on
 * unmount; this slot is presentation + a single submit handler.
 * Sparkle icons are allowed here per `frontend/CLAUDE.md` because
 * Gemma 4 is actively running on this pixel — this is the AI
 * surface itself.
 */
export function AiExpandedSlot({ onClose }: AiExpandedSlotProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const { status, messages, error, ask, clear } = useAskAi();
  const [draft, setDraft] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Pin-to-bottom flag. Lives in a ref (not state) because we read it
  // synchronously from the ResizeObserver callback — re-rendering on
  // every scroll event would be wasteful and racy against streaming.
  const pinnedRef = useRef(true);

  // Autofocus the composer on open — the user came here to type a
  // question, not to read placeholder text.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Track whether the user is "stuck to the bottom". Once they scroll
  // up more than ~80px we stop hijacking — they're reading history,
  // don't yank them back mid-token.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl === null) return;
    const onScroll = (): void => {
      const dist = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      pinnedRef.current = dist < 80;
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Auto-scroll on content growth via ResizeObserver. The effect-
  // based approach kept missing mid-stream token appends because
  // `lastTextLen` snapshots before layout completes and the
  // AnimatePresence branch swap left scrollHeight at 0 for a frame.
  // Observing the content wrapper fires on every actual size change —
  // token append, bubble mount, branch fade — and we scroll only when
  // the user was already pinned to the bottom.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (scrollEl === null || contentEl === null) return;
    const observer = new ResizeObserver(() => {
      if (!pinnedRef.current) return;
      // Instant scroll, not smooth. Smooth queues animations behind a
      // moving target during streaming and visibly lags the latest
      // token by half a second.
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    observer.observe(contentEl);
    return () => {
      observer.disconnect();
    };
  }, []);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const question = draft.trim();
    if (question.length === 0 || status === 'streaming') return;
    setDraft('');
    void ask(question, 'personal');
  };

  const pickSuggestion = (prompt: string): void => {
    if (status === 'streaming') return;
    setDraft('');
    void ask(prompt, 'personal');
  };

  const isStreaming = status === 'streaming';
  const hasHistory = messages.length > 0;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <img
          src="/logo/ai-blob-logo.webp"
          alt=""
          width={20}
          height={20}
          className="size-5 shrink-0 rounded-full object-cover"
        />
        <span className="text-ink text-badge font-semibold tracking-[0.16em] uppercase">
          Personal AI
        </span>
        <div className="flex-1" />
        {hasHistory || isClearing ? (
          <button
            type="button"
            disabled={isClearing}
            onClick={() => {
              setIsClearing(true);
              void clear().finally(() => setIsClearing(false));
            }}
            aria-label="Clear chat"
            aria-busy={isClearing}
            className="text-ink-muted hover:text-ink shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            {isClearing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-ink-muted hover:text-ink shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/5"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        aria-atomic="false"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div ref={contentRef} className="min-h-full">
          <AnimatePresence mode="wait" initial={false}>
            {error !== null ? (
              <FadeSwap key="error" reducedMotion={Boolean(reducedMotion)}>
                <span className="text-destructive text-control">{error}</span>
              </FadeSwap>
            ) : isClearing ? (
              <FadeSwap key="clearing" reducedMotion={Boolean(reducedMotion)}>
                <div
                  className="text-ink-muted text-control flex h-full items-center justify-center gap-2"
                  aria-live="polite"
                >
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  <ShimmerText>clearing chat…</ShimmerText>
                </div>
              </FadeSwap>
            ) : !hasHistory && !isStreaming ? (
              <FadeSwap key="empty" reducedMotion={Boolean(reducedMotion)}>
                <SuggestionRail onPick={pickSuggestion} />
              </FadeSwap>
            ) : (
              <FadeSwap key="messages" reducedMotion={Boolean(reducedMotion)}>
                {/* min-h-full + justify-end pins the stack to the bottom
                    of the scroll area so a single bubble sits just above
                    the composer instead of floating at the top. When the
                    column overflows the viewport, the inner div grows
                    past full height and the ResizeObserver keeps the
                    latest token at the bottom. */}
                <div className="flex min-h-full flex-col justify-end gap-3">
                  {messages.map((message, idx) => (
                    <MessageBubble
                      key={`${message.createdAt}-${idx}`}
                      message={message}
                      reducedMotion={Boolean(reducedMotion)}
                    />
                  ))}
                </div>
              </FadeSwap>
            )}
          </AnimatePresence>
        </div>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isStreaming ? 'cooking…' : 'ask anything'}
          disabled={isStreaming}
          maxLength={2000}
          className={cn(
            'bg-surface-composer text-ink text-control flex-1 rounded-full px-4 py-2',
            'placeholder:text-ink-muted',
            'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
            'disabled:opacity-60',
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isStreaming || draft.trim().length === 0}
          aria-label="Send"
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
