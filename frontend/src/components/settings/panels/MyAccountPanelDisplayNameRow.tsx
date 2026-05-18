import { useUpdateProfile } from '@/queries/profile';
import { toast } from '@/lib/toast';
import { EditableRow } from './MyAccountPanelEditableRow';
import { InlineTextEdit } from './MyAccountPanelInlineTextEdit';

interface DisplayNameRowProps {
  current: string | null;
  fallback: string;
}

export function DisplayNameRow({ current, fallback }: DisplayNameRowProps): React.JSX.Element {
  const update = useUpdateProfile();

  return (
    <EditableRow
      label="Display name"
      display={current ?? <span className="text-ink-muted">{fallback}</span>}
      renderEdit={({ onDone }) => (
        <InlineTextEdit
          initial={current ?? ''}
          maxLength={64}
          placeholder="Pick a display name"
          submitting={update.isPending}
          onCancel={onDone}
          onSubmit={(value) => {
            const trimmed = value.trim();
            update.mutate(
              { display_name: trimmed.length === 0 ? null : trimmed },
              {
                onSuccess: () => {
                  toast.success('Display name updated.');
                  onDone();
                },
                onError: () => toast.error("Couldn't save. Try again?"),
              },
            );
          }}
        />
      )}
    />
  );
}
