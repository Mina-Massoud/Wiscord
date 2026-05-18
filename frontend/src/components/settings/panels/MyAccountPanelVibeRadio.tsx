import { useUpdateProfile } from '@/queries/profile';
import type { Vibe } from '@/types/auth';
import { toast } from '@/lib/toast';
import { VoiceRadioOption } from './MyAccountPanelVoiceRadioOption';

interface VibeRadioProps {
  current: Vibe;
}

/**
 * Settings — three-option vibe picker. Replaces the legacy two-option
 * voice-style radio. Same `VoiceRadioOption` primitive as before so
 * the surface stays visually identical; we just add a third row and
 * swap the data model.
 *
 * On select: PATCH `/auth/me` with `{ vibe }`. The mutation writes
 * the result into the auth query cache so every `useCopy()` consumer
 * re-renders with the new register in the same tick.
 */
export function VibeRadio({ current }: VibeRadioProps): React.JSX.Element {
  const update = useUpdateProfile();

  function set(value: Vibe): void {
    if (value === current) return;
    update.mutate(
      { vibe: value },
      {
        onError: () => toast.error("Couldn't save your vibe. Try again?"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <VoiceRadioOption
        active={current === 'genz'}
        onClick={() => set('genz')}
        title="Gen Z"
        body="The Gang. Lock In. Add a Bestie. Dry group-chat energy."
      />
      <VoiceRadioOption
        active={current === 'chill'}
        onClick={() => set('chill')}
        title="Chill"
        body="Friends. Focusing now. Add Friend. Warm and casual, no slang."
      />
      <VoiceRadioOption
        active={current === 'professional'}
        onClick={() => set('professional')}
        title="Professional"
        body="Contacts. Connected. Send Friend Request. Full sentences, no emojis."
      />
    </div>
  );
}
