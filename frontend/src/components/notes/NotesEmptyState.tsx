import { FileText } from 'lucide-react';

/**
 * Rendered inside the editor surface when the document is empty AND the
 * user hasn't focused yet. Once they click in, the Placeholder extension
 * takes over with its inline grey hint.
 *
 * Deliberately title-less — the doc's title already lives in the
 * AppShellLayout topBar and the labs-index sidebar. Repeating it here
 * would be the third label for the same surface. See CLAUDE.md
 * "Drop redundant labels" — one signal per surface.
 */
export function NotesEmptyState(): React.JSX.Element {
  return (
    <div className="text-ink-muted pointer-events-none flex flex-col items-center gap-3 px-8 py-12 text-center">
      <div className="bg-glass-surface-2 border-glass-border flex h-10 w-10 items-center justify-center rounded-full border">
        <FileText className="text-ink-muted size-4" aria-hidden />
      </div>
      <p className="text-caption max-w-sm">
        Drop ideas, links, or homework here. Everyone in the channel sees them live — no save
        button, no lost edits.
      </p>
    </div>
  );
}
