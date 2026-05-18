import { confirmTool, type AiToolCall } from '@/queries/ai';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { NotebookPen, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { GenerateExamToolRow } from './AiExpandedSlotGenerateExamToolRow';

export function ToolCallRow({ call }: { call: AiToolCall }): React.JSX.Element {
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

  // generateExam owns its own busy / resolved / result state because
  // the confirm-POST response is what carries `{ quizId, channelId,
  // link }` — `call.result` only populates after the conversation
  // query refetches, which is too slow to drive the resolved pill.
  if (call.name === 'generateExam') {
    return (
      <GenerateExamToolRow
        call={call}
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
