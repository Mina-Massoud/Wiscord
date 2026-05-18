import { useUpdateProfile } from '@/queries/profile';
import type { Role } from '@/types/auth';
import { toast } from '@/lib/toast';
import { VoiceRadioOption } from './MyAccountPanelVoiceRadioOption';

interface RoleRadioProps {
  current: Role;
}

/**
 * Settings — role picker (student / teacher). Editable post-onboarding
 * so a user who picked the wrong role can fix it without us forcing
 * them through the whole flow again.
 *
 * Intentionally does NOT auto-flip `vibe` when the role changes — the
 * user's explicit vibe choice wins. If they want a vibe shift to match
 * the new role, they pick it from the vibe row right below.
 */
export function RoleRadio({ current }: RoleRadioProps): React.JSX.Element {
  const update = useUpdateProfile();

  function set(value: Role): void {
    if (value === current) return;
    update.mutate(
      { role: value },
      {
        onError: () => toast.error("Couldn't save your role. Try again?"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <VoiceRadioOption
        active={current === 'student'}
        onClick={() => set('student')}
        title="Student"
        body="Studying, prepping for exams, locking in with friends."
      />
      <VoiceRadioOption
        active={current === 'teacher'}
        onClick={() => set('teacher')}
        title="Teacher"
        body="Running a class, sharing notes, building quizzes for students."
      />
    </div>
  );
}
