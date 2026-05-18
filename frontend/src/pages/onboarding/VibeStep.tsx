import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { defaultVibeForRole } from '@/hooks/useVibe';
import { toast } from '@/lib/toast';
import { useUpdateProfile } from '@/queries/profile';
import type { Vibe } from '@/types/auth';
import { OnboardingProgress } from './OnboardingProgress';
import { VibeStepPreviewBubble } from './VibeStepPreviewBubble';
import { VibeStepVibeCard } from './VibeStepVibeCard';
import { VIBE_SAMPLES } from './vibeSamples';

const VIBE_ORDER: Vibe[] = ['genz', 'chill', 'professional'];

/**
 * Second step of onboarding — how Wiscord should sound. Three vibe
 * cards plus a live preview bubble that updates as the user changes
 * selection (Pi-style preview, mobbin: b5433bd0). The chosen role
 * from step 1 pre-selects the recommended default (`student → genz`,
 * `teacher → professional`); user can override.
 *
 * Commits vibe to the backend on submit and routes to profile. No
 * back button — vibe is editable from settings later, and step 1
 * already committed.
 */
export default function VibeStep(): React.JSX.Element {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();

  const recommended: Vibe = profile?.role ? defaultVibeForRole(profile.role) : 'genz';
  // Use the user's existing vibe (if they've already passed through
  // this step and refreshed) so the preview reflects their saved
  // choice; otherwise the recommended default for their role.
  const [selected, setSelected] = useState<Vibe>(profile?.vibe ?? recommended);

  async function onContinue(): Promise<void> {
    try {
      await updateProfile.mutateAsync({ vibe: selected });
      void navigate('/onboarding/profile');
    } catch {
      toast.error("Couldn't save that. Try again?");
    }
  }

  const sample = VIBE_SAMPLES[selected];

  return (
    <div className="flex flex-col">
      <OnboardingProgress step={2} />

      <h2 className="text-ink text-subhead mb-1 text-center font-semibold">How should we sound?</h2>
      <p className="text-ink-muted text-caption mb-6 text-center">
        Sets the voice for Wismate, toasts, and labels across the app.
      </p>

      <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-2">
          {VIBE_ORDER.map((vibe) => (
            <VibeStepVibeCard
              key={vibe}
              label={VIBE_SAMPLES[vibe].label + (vibe === recommended ? ' · Recommended' : '')}
              description={VIBE_SAMPLES[vibe].description}
              selected={selected === vibe}
              onSelect={() => setSelected(vibe)}
            />
          ))}
        </div>

        <VibeStepPreviewBubble sample={sample} />
      </div>

      <Button onClick={onContinue} disabled={updateProfile.isPending} className="mt-6 w-full">
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
