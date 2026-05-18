import { useUpdateProfile, useUsernameAvailable } from '@/queries/profile';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EditableRow } from './MyAccountPanelEditableRow';
import { UsernameHint } from './MyAccountPanelUsernameHint';

const USERNAME_RE = /^[a-z0-9_]{2,32}$/i;

interface UsernameRowProps {
  current: string;
}

export function UsernameRow({ current }: UsernameRowProps): React.JSX.Element {
  const update = useUpdateProfile();
  const [draft, setDraft] = useState(current);
  const { isChecking, isAvailable } = useUsernameAvailable(draft === current ? '' : draft);
  const valid = USERNAME_RE.test(draft);
  const isSame = draft === current;
  const canSubmit = valid && !isSame && !isChecking && isAvailable !== false && !update.isPending;

  return (
    <EditableRow
      label="Username"
      display={<span>@{current}</span>}
      renderEdit={({ onDone }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            update.mutate(
              { username: draft },
              {
                onSuccess: () => {
                  toast.success('Username updated.');
                  onDone();
                },
                onError: (err) => toast.error(err.message ?? "Couldn't save. Try again?"),
              },
            );
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={32}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!canSubmit}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(current);
                onDone();
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-caption">
            <UsernameHint
              draft={draft}
              isSame={isSame}
              valid={valid}
              isChecking={isChecking}
              isAvailable={isAvailable}
            />
          </p>
        </form>
      )}
    />
  );
}
