import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListChecks, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { confirmTool, type AiToolCall } from '@/queries/ai';

/**
 * generateExam tool row. Three states:
 *  1. confirm card — shows topic + question count + types so the user
 *     knows what they're about to spawn before clicking "generate"
 *     (the model takes 10-60s to write a real exam and writes a draft
 *     into their workshop).
 *  2. busy — confirm clicked, generation in flight. Spinner + label.
 *  3. resolved — backend returned `{ quizId, channelId, link }`.
 *     Renders a clickable pill that opens the workshop draft.
 *
 * This component owns its own confirm flow rather than going through
 * the shared `ToolCallRow.onAction` because the confirm-POST response
 * is what carries `quizId` + `channelId` — `call.result` only
 * populates after the conversation query refetches, which is too slow
 * to drive the resolved pill. We stash the response in local state and
 * also invalidate the conversation query so the persisted call.result
 * matches on next mount.
 */
export function GenerateExamToolRow({
  call,
  onOpen,
}: {
  call: AiToolCall;
  onOpen: (channelId: string, quizId: string) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [localResolved, setLocalResolved] = useState(false);
  const [localResult, setLocalResult] = useState<Record<string, unknown> | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const title = typeof call.args.title === 'string' ? call.args.title : 'Untitled quiz';
  const topic = typeof call.args.topic === 'string' ? call.args.topic : null;
  const count = typeof call.args.questionCount === 'number' ? call.args.questionCount : null;
  const rawTypes = call.args.types;
  const types = Array.isArray(rawTypes)
    ? rawTypes.filter((t): t is string => typeof t === 'string')
    : [];

  const resolved = call.resolved || localResolved;
  const result = localResult ?? call.result;
  const errorText = localError ?? call.error;

  if (resolved) {
    const failed = errorText !== null;
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

  const onAction = async (action: 'confirm' | 'decline'): Promise<void> => {
    setBusy(true);
    try {
      const response = await confirmTool(call.callId, action);
      if (action === 'confirm') {
        // Capture the response's result locally so the resolved pill
        // has channelId + quizId without waiting for the conversation
        // query to refetch. The shape is what `runGenerateExam`
        // returned: { quizId, channelId, title, questionCount, link }.
        if (response.result) {
          setLocalResult(response.result);
        }
      }
      // Refetch the persisted conversation so next mount reads the
      // result off `call.result` instead of relying on local state.
      void queryClient.invalidateQueries({ queryKey: ['ai', 'conversation', 'personal'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Try again?';
      setLocalError(message);
      toast.error(
        action === 'confirm' ? "Couldn't generate the exam." : "Couldn't decline that action.",
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
