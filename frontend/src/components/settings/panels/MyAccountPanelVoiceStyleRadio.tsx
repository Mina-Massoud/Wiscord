import { useUpdateProfile } from '@/queries/profile';
import type { VoiceStyle } from '@/types/auth';
import { toast } from '@/lib/toast';
import { VoiceRadioOption } from './MyAccountPanelVoiceRadioOption';

interface VoiceStyleRadioProps {
  current: VoiceStyle;
}

export function VoiceStyleRadio({ current }: VoiceStyleRadioProps): React.JSX.Element {
  const update = useUpdateProfile();

  function set(value: VoiceStyle): void {
    if (value === current) return;
    update.mutate(
      { voice_style: value },
      {
        onError: () => toast.error("Couldn't save your voice. Try again?"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <VoiceRadioOption
        active={current === 'default'}
        onClick={() => set('default')}
        title="Default"
        body="Friends. Pending. Add Friend. Standard product copy."
      />
      <VoiceRadioOption
        active={current === 'genz'}
        onClick={() => set('genz')}
        title="Gen Z"
        body="The Gang. On Pending. Add a Bestie. Same product, looser tone."
      />
    </div>
  );
}
