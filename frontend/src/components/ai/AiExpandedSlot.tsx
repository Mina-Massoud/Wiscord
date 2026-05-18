import {
  Sparkles,
  X,
  ArrowUp,
  NotebookPen,
  CalendarClock,
  Brain,
  ListChecks,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import {
  confirmTool,
  segmentAssistantText,
  useAskAi,
  type AiMessage,
  type AiSource,
  type AiToolCall,
} from '@/queries/ai';

import { ShimmerText } from './ShimmerText';
import { useAiCapsuleStore } from './useAiCapsuleStore';

/**
 * Pre-baked prompts that double as a "what can this thing do" pitch.
 * Each one is grounded in a real Wiscord data source so the first
 * answer the user sees demonstrates the retrieval working — not a
 * generic LLM response that could come from anywhere.
 *
 * Icon picks are literal (NotebookPen for notes, CalendarClock for
 * calendar, ListChecks for quiz attempts, Brain for the "what should
 * I focus on" cross-signal prompt) — sparkle icons stay reserved for
 * the surface header and the streaming-response area itself.
 */
interface Suggestion {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <NotebookPen className="size-4" aria-hidden />,
    label: 'tldr my latest notes',
    prompt: "what's in my most recent notes? give me a tight summary.",
  },
  {
    icon: <CalendarClock className="size-4" aria-hidden />,
    label: "what's on my calendar this week",
    prompt: 'what study sessions and events do i have coming up in the next 7 days?',
  },
  {
    icon: <ListChecks className="size-4" aria-hidden />,
    label: 'how brutal were my last quizzes',
    prompt: 'how am i doing on my recent quiz attempts? where am i weakest?',
  },
  {
    icon: <Brain className="size-4" aria-hidden />,
    label: 'what should i lock in next',
    prompt:
      'based on my notes, calendar, and recent activity, what should i work on in my next study session?',
  },
];

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

/**
 * Single message bubble. User bubbles right-align in a blurple
 * pill; assistant bubbles left-align with the AI logo. Citation
 * chips live under the assistant bubble that produced them so the
 * association reads cleanly even across multi-turn history.
 *
 * Pending assistant bubbles (mid-stream) show a soft shimmer on
 * the latest text via the keyed motion span — same trick the
 * legacy single-answer view used.
 */
function MessageBubble({
  message,
  reducedMotion,
}: {
  message: AiMessage;
  reducedMotion: boolean;
}): React.JSX.Element {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-blurple/15 text-ink text-control max-w-[80%] rounded-2xl rounded-tr-md px-3 py-2 whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex items-start gap-2">
      <img
        src="/logo/ai-blob-logo.webp"
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0 rounded-full object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-ink text-control whitespace-pre-wrap">
          {message.pending && message.text.length === 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="text-ink-muted size-3 animate-pulse" aria-hidden />
              <ShimmerText>cooking…</ShimmerText>
            </span>
          ) : message.text.length === 0 && message.toolCalls.length === 0 ? (
            // Gemma 4 sometimes returns an empty content block when
            // tools are attached and no tool was picked — the assistant
            // turn lands persisted with `text: ''`. Render a fallback
            // instead of a void bubble so the user knows to retry.
            <span className="text-ink-muted italic">no answer this time — try rephrasing 🙏</span>
          ) : reducedMotion ? (
            <CitedText text={message.text} sources={message.sources} />
          ) : (
            <motion.span
              key={message.text.length}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <CitedText text={message.text} sources={message.sources} />
            </motion.span>
          )}
        </div>
        {/* Citations render inline inside the text via `CitedText` */}
        {/* now — no separate chip row under the bubble. Showing them */}
        {/* both was a duplication bug. */}
        {message.toolCalls.length > 0 ? <ToolCallStack toolCalls={message.toolCalls} /> : null}
      </div>
    </div>
  );
}

/**
 * Renders each tool call attached to an assistant turn. Two
 * shapes: a status chip for resolved/non-destructive calls, and a
 * confirm card for destructive calls waiting on the user. The
 * confirm path calls `confirmTool` and optimistically marks the
 * call resolved so feedback lands instantly.
 */
function ToolCallStack({ toolCalls }: { toolCalls: AiToolCall[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {toolCalls.map((call) => (
        <ToolCallRow key={call.callId} call={call} />
      ))}
    </div>
  );
}

function ToolCallRow({ call }: { call: AiToolCall }): React.JSX.Element {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [localResolved, setLocalResolved] = useState(false);

  const verb =
    call.name === 'createCalendarEvent'
      ? 'add event'
      : call.name === 'updateCalendarEvent'
        ? 'update event'
        : call.name === 'deleteCalendarEvent'
          ? 'delete event'
          : call.name === 'generateExam'
            ? 'generate exam'
            : 'save note';
  const title = typeof call.args.title === 'string' ? call.args.title : undefined;
  const resolved = call.resolved || localResolved;

  // generateExam has its own confirm card AND resolved pill — the
  // confirm card shows topic + question count, the resolved pill
  // links into the workshop draft via the returned link/channelId.
  if (call.name === 'generateExam') {
    return (
      <GenerateExamToolRow
        call={call}
        resolved={resolved}
        busy={busy}
        onAction={async (action) => {
          setBusy(true);
          try {
            await confirmTool(call.callId, action);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Try again?';
            toast.error(
              action === 'confirm'
                ? "Couldn't generate the exam."
                : "Couldn't decline that action.",
              { description: message },
            );
          } finally {
            setLocalResolved(true);
            setBusy(false);
          }
        }}
        onOpen={(channelId, quizId) => navigate(`/app/labs/quiz/${channelId}?quiz=${quizId}`)}
      />
    );
  }

  // createNote: when resolved we render a clickable pill that opens
  // the freshly-created notes doc. The `channelId` comes back from
  // the backend `runCreateNote` result. No confirmation flow — this
  // tool is non-destructive and runs inline, so we only ever see the
  // resolved state in the UI.
  if (call.name === 'createNote') {
    const channelId =
      call.result && typeof call.result.channelId === 'string' ? call.result.channelId : null;
    const failed = call.error !== null;
    const label = title ?? 'note';
    if (failed || !channelId) {
      return (
        <div className="border-glass-border bg-destructive/10 text-destructive text-control flex items-center gap-2 rounded-xl border px-3 py-1.5">
          <NotebookPen className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">couldn&apos;t save note · {label}</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => navigate(`/app/labs/notes/${channelId}`)}
        className="border-blurple/30 bg-blurple/10 hover:bg-blurple/20 text-ink text-control flex w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors"
        aria-label={`open note ${label}`}
      >
        <NotebookPen className="text-blurple size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          saved · <span className="font-semibold">{label}</span>
        </span>
        <span className="text-ink-muted text-badge shrink-0">open</span>
      </button>
    );
  }

  if (resolved) {
    const failed = call.error !== null;
    return (
      <div
        className={cn(
          'border-glass-border text-control flex items-center gap-2 rounded-xl border px-3 py-1.5',
          failed ? 'text-destructive bg-destructive/10' : 'text-ink bg-blurple/10',
        )}
      >
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {failed
            ? `couldn't ${verb}${title ? ` · ${title}` : ''}`
            : `${verb}${title ? ` · ${title}` : ''} — done`}
        </span>
      </div>
    );
  }

  const onAction = async (action: 'confirm' | 'decline') => {
    setBusy(true);
    try {
      await confirmTool(call.callId, action);
    } catch (err) {
      // Surface so the user knows the click didn't land server-side
      // (could be a stale callId after a server restart, an expired
      // session, or a transient network blip).
      const message = err instanceof Error ? err.message : 'Try again?';
      toast.error(
        action === 'confirm' ? "Couldn't confirm that action." : "Couldn't decline that action.",
        { description: message },
      );
    } finally {
      setLocalResolved(true);
      setBusy(false);
    }
  };

  return (
    <div className="border-glass-border bg-glass-surface-2 flex flex-col gap-2 rounded-xl border p-3">
      <div className="text-ink text-control">
        AI wants to <span className="font-semibold">{verb}</span>
        {title ? <span> · {title}</span> : null}. confirm?
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => {
            void onAction('confirm');
          }}
        >
          confirm
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            void onAction('decline');
          }}
        >
          decline
        </Button>
      </div>
    </div>
  );
}

/**
 * generateExam tool row. Three states:
 *  1. confirm card — shows topic + question count + types so the
 *     user knows what they're about to spawn before clicking
 *     "generate" (this can take 30-60s for big exams and writes a
 *     draft into their workshop).
 *  2. busy — confirm clicked, model is generating. Spinner + label.
 *  3. resolved — backend returned `{ quizId, channelId, link }`.
 *     Render a clickable pill that opens the workshop draft.
 */
function GenerateExamToolRow({
  call,
  resolved,
  busy,
  onAction,
  onOpen,
}: {
  call: AiToolCall;
  resolved: boolean;
  busy: boolean;
  onAction: (action: 'confirm' | 'decline') => Promise<void>;
  onOpen: (channelId: string, quizId: string) => void;
}): React.JSX.Element {
  const title = typeof call.args.title === 'string' ? call.args.title : 'Untitled quiz';
  const topic = typeof call.args.topic === 'string' ? call.args.topic : null;
  const count = typeof call.args.questionCount === 'number' ? call.args.questionCount : null;
  const rawTypes = call.args.types;
  const types = Array.isArray(rawTypes)
    ? rawTypes.filter((t): t is string => typeof t === 'string')
    : [];

  if (resolved) {
    const failed = call.error !== null;
    const result = call.result;
    const channelId = result && typeof result.channelId === 'string' ? result.channelId : null;
    const quizId = result && typeof result.quizId === 'string' ? result.quizId : null;
    const produced =
      result && typeof result.questionCount === 'number' ? result.questionCount : null;

    if (failed || !channelId || !quizId) {
      return (
        <div className="border-glass-border bg-destructive/10 text-destructive text-control flex items-center gap-2 rounded-xl border px-3 py-1.5">
          <ListChecks className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">couldn&apos;t generate · {title}</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onOpen(channelId, quizId)}
        className="border-blurple/30 bg-blurple/10 hover:bg-blurple/20 text-ink text-control flex w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors"
        aria-label={`open quiz ${title}`}
      >
        <ListChecks className="text-blurple size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          drafted · <span className="font-semibold">{title}</span>
          {produced !== null ? <span className="text-ink-muted"> · {produced} q</span> : null}
        </span>
        <span className="text-ink-muted text-badge shrink-0">open</span>
      </button>
    );
  }

  if (busy) {
    return (
      <div className="border-glass-border bg-glass-surface-2 text-ink text-control flex items-center gap-2 rounded-xl border px-3 py-2">
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          generating · <span className="font-semibold">{title}</span>
          {count !== null ? <span className="text-ink-muted"> · {count} q</span> : null}
        </span>
      </div>
    );
  }

  return (
    <div className="border-glass-border bg-glass-surface-2 flex flex-col gap-2 rounded-xl border p-3">
      <div className="text-ink text-control">
        AI wants to <span className="font-semibold">generate</span> a quiz · {title}
      </div>
      <div className="text-ink-muted text-badge flex flex-wrap items-center gap-2">
        {count !== null ? <span>{count} questions</span> : null}
        {topic ? <span>· {topic}</span> : null}
        {types.length > 0 ? <span>· {types.join(', ')}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => {
            void onAction('confirm');
          }}
        >
          generate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            void onAction('decline');
          }}
        >
          cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Pre-baked-prompt rail. Shown in the empty state (first open / no
 * answer yet) so the user sees *what* the assistant is good at
 * inside Wiscord without having to guess. Each row submits its
 * prompt verbatim — no editing step — because the value is in the
 * "I see what this does" beat, not in the user typing more.
 */
function SuggestionRail({ onPick }: { onPick: (prompt: string) => void }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-ink-muted text-caption">
        notes, calendar, recent stuff — pick one to start.
      </p>
      <div className="flex flex-col gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPick(suggestion.prompt)}
            className="text-ink text-control hover:bg-blurple/10 focus-visible:ring-blurple flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-blurple/15 text-blurple flex size-7 shrink-0 items-center justify-center rounded-full">
              {suggestion.icon}
            </span>
            <span className="truncate">{suggestion.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders an assistant turn with `[note:id]` / `[event:id]` /
 * `[attempt:id]` / `[activity:id]` markers swapped for inline
 * interactive badges. Clicking an event or note badge opens the
 * matching inline source pane via the AI capsule store — event
 * badges carry the cited day so the calendar lands on the right
 * date instead of always opening on "today".
 *
 * Unknown ids (matched by regex but absent from the turn's
 * `sources` array) fall through as the raw bracket text — better
 * to show the original marker than silently drop content.
 */
function CitedText({ text, sources }: { text: string; sources: AiSource[] }): React.JSX.Element {
  const navigate = useNavigate();
  const openSourcePane = useAiCapsuleStore((s) => s.openSourcePane);
  const segments = segmentAssistantText(text, sources);
  if (segments.length === 0) return <span>{text}</span>;
  return (
    <span>
      {segments.map((seg, idx) =>
        seg.kind === 'text' ? (
          <span key={idx}>{seg.value}</span>
        ) : (
          <InlineCitationBadge
            key={idx}
            source={seg.source}
            onOpen={() => {
              const rawId = seg.source.id.split(':').slice(1).join(':');
              if (seg.source.kind === 'event') {
                openSourcePane({
                  kind: 'event',
                  id: rawId,
                  title: seg.source.label,
                  startAt: seg.source.startAt,
                });
              } else if (seg.source.kind === 'note') {
                openSourcePane({
                  kind: 'note',
                  id: rawId,
                  title: seg.source.label,
                });
              } else if (seg.source.kind === 'quiz' && seg.source.channelId) {
                // Quiz chips deep-link straight into the workshop —
                // the user just confirmed the generation; they want
                // to land on the editable draft, not in a sidepane.
                navigate(`/app/labs/quiz/${seg.source.channelId}?quiz=${rawId}`);
              }
              // attempt / activity have no inline pane — clicks fall
              // through to a no-op for now; deep-linking to existing
              // pages is the next polish pass.
            }}
          />
        ),
      )}
    </span>
  );
}

/**
 * Animated wrapper for the body's branch swap (error / clearing /
 * empty / messages). Opacity-only fade per the animate-only-
 * `transform`/`opacity`/`filter` rule. Honors `prefers-reduced-
 * motion` by skipping the animation entirely.
 */
function FadeSwap({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}): React.JSX.Element {
  if (reducedMotion) {
    return <div className="h-full">{children}</div>;
  }
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Single inline citation pill. `display: inline-flex` so it sits
 * mid-sentence instead of as a block element. Note + event chips
 * are clickable; attempt / activity render as static labels until
 * we have an inline pane for those kinds.
 */
function InlineCitationBadge({
  source,
  onOpen,
}: {
  source: AiSource;
  onOpen: () => void;
}): React.JSX.Element {
  const clickable =
    source.kind === 'note' ||
    source.kind === 'event' ||
    (source.kind === 'quiz' && Boolean(source.channelId));
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onOpen : undefined}
      title={source.label}
      className={cn(
        'bg-blurple/15 text-blurple text-badge mx-0.5 inline-flex max-w-[160px] items-center truncate rounded-full px-2 py-0.5 align-baseline font-medium transition-colors',
        clickable && 'hover:bg-blurple/25 cursor-pointer',
        !clickable && 'cursor-default opacity-70',
      )}
    >
      {source.label}
    </button>
  );
}
