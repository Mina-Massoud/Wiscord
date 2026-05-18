import { ExternalLink, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router';

import { cn } from '@/lib/cn';
import { ApiError } from '@/queries/client';
import { useNotePlaintext } from '@/queries/ai';

interface AiInlineNoteViewProps {
  channelId: string;
  title: string;
  onClose: () => void;
}

/**
 * Read-only inline note viewer for the AI capsule's source pane.
 * Fetches the plaintext via `useNotePlaintext` (cached) and
 * renders it as wrapped paragraphs. No editor mount — the "Open
 * in editor" button routes to the live TipTap surface for any
 * real writing.
 */
export function AiInlineNoteView({
  channelId,
  title,
  onClose,
}: AiInlineNoteViewProps): React.JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading, error } = useNotePlaintext(channelId);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileText className="text-ink-muted size-4 shrink-0" aria-hidden />
        <span className="text-ink text-control min-w-0 flex-1 truncate font-semibold">{title}</span>
        <button
          type="button"
          onClick={() => navigate(`/app/labs/notes/${channelId}`)}
          aria-label="Open in editor"
          className="text-ink-muted hover:text-ink inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-white/5"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="text-badge">edit</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close note view"
          className="text-ink-muted hover:text-ink shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/5"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          'text-ink text-control whitespace-pre-wrap',
        )}
      >
        {isLoading ? (
          <span className="text-ink-muted">loading note…</span>
        ) : error ? (
          error instanceof ApiError && error.code === 'note_not_found' ? (
            <span className="text-ink-muted">this note got deleted 💀</span>
          ) : (
            <span className="text-destructive">couldn&apos;t load this note.</span>
          )
        ) : data && data.plaintext.length > 0 ? (
          data.plaintext
        ) : (
          <span className="text-ink-muted">this note is empty.</span>
        )}
      </div>
    </div>
  );
}
