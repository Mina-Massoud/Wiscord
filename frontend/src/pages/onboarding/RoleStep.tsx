import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GraduationCap, BookOpen, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { useUpdateProfile } from '@/queries/profile';
import type { Role } from '@/types/auth';
import { OnboardingProgress } from './OnboardingProgress';
import { RoleStepRoleCard } from './RoleStepRoleCard';

/**
 * First step of onboarding — who is using Wiscord. Two large cards
 * modeled on Brilliant's role picker (mobbin: 91f4c7b5). The choice
 * drives the *suggested* default vibe on the next step (`student →
 * genz`, `teacher → professional`) but the user can override.
 *
 * Commits role to the backend on submit, then routes to the vibe step.
 * No back button — once the PATCH lands the step is irreversible (the
 * user can still change role from settings later).
 */
export default function RoleStep(): React.JSX.Element {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const [selected, setSelected] = useState<Role | null>(null);

  async function onContinue(): Promise<void> {
    if (!selected) return;
    try {
      await updateProfile.mutateAsync({ role: selected });
      void navigate('/onboarding/vibe');
    } catch {
      toast.error("Couldn't save that. Try again?");
    }
  }

  return (
    <div className="flex flex-col">
      <OnboardingProgress step={1} />

      <h2 className="text-ink text-subhead mb-1 text-center font-semibold">Who's using Wiscord?</h2>
      <p className="text-ink-muted text-caption mb-6 text-center">
        Pick the role that fits you best. You can change this later.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleStepRoleCard
          icon={GraduationCap}
          title="Student"
          description="Studying, prepping for exams, locking in with friends."
          selected={selected === 'student'}
          onSelect={() => setSelected('student')}
        />
        <RoleStepRoleCard
          icon={BookOpen}
          title="Teacher"
          description="Running a class, sharing notes, building quizzes for students."
          selected={selected === 'teacher'}
          onSelect={() => setSelected('teacher')}
        />
      </div>

      <Button
        onClick={onContinue}
        disabled={!selected || updateProfile.isPending}
        className="mt-6 w-full"
      >
        {updateProfile.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  );
}
