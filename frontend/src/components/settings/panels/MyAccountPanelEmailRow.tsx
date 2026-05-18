import { useState } from 'react';
import { EditableRow } from './MyAccountPanelEditableRow';

interface EmailRowProps {
  email: string;
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${'•'.repeat(Math.max(local.length, 4))}@${domain}`;
}

export function EmailRow({ email }: EmailRowProps): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const masked = maskEmail(email);
  return (
    <EditableRow
      label="Email"
      display={
        <span>
          {revealed ? email : masked}{' '}
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-blurple hover:underline"
          >
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        </span>
      }
    />
  );
}
