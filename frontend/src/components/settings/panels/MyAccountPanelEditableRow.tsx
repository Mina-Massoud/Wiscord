import { useState } from 'react';

interface EditableRowProps {
  label: string;
  /** What to render in read-only mode. */
  display: React.ReactNode;
  /** When provided, "Edit" toggles to the edit form rendered by the caller. */
  renderEdit?: (props: { onDone: () => void }) => React.ReactNode;
  /** Extra trailing action (e.g. "Remove" next to "Edit"). */
  trailing?: React.ReactNode;
}

export function EditableRow({
  label,
  display,
  renderEdit,
  trailing,
}: EditableRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-white/5 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
            {label}
          </span>
          {!editing ? <div className="text-ink text-control mt-1">{display}</div> : null}
        </div>
        {!editing ? (
          <div className="flex items-center gap-2">
            {trailing}
            {renderEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-ink-muted hover:bg-glass-hover text-control rounded-md bg-white/5 px-3 py-1 font-medium transition-colors hover:text-white"
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {editing && renderEdit ? (
        <div className="mt-1">{renderEdit({ onDone: () => setEditing(false) })}</div>
      ) : null}
    </div>
  );
}
