import { NotebookPen, CalendarClock, Brain, ListChecks } from 'lucide-react';

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

/**
 * Pre-baked-prompt rail. Shown in the empty state (first open / no
 * answer yet) so the user sees *what* the assistant is good at
 * inside Wiscord without having to guess. Each row submits its
 * prompt verbatim — no editing step — because the value is in the
 * "I see what this does" beat, not in the user typing more.
 */
export function SuggestionRail({
  onPick,
}: {
  onPick: (prompt: string) => void;
}): React.JSX.Element {
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
