import { useState } from 'react';
import { findActivity, type ActivityDefinition } from '@/components/activity/ActivityRegistry';
import { PartyPopper, ScreenShare, Shapes, Timer } from 'lucide-react';
import { ActivityLauncherDialog } from '@/components/activity/ActivityLauncherDialog';
import { ChunkyButton } from './VoiceStatusRowChunkyButton';

interface VoiceChunkyRowProps {
  onActivitySelect?: (activity: ActivityDefinition) => void;
}

/**
 * The four Discord-style chunky buttons that sit under the status row.
 * Each is a full-width square with a single literal icon — no labels in
 * the chrome, label lives in the tooltip.
 */
export function VoiceChunkyRow({ onActivitySelect }: VoiceChunkyRowProps): React.JSX.Element {
  const [launcherOpen, setLauncherOpen] = useState(false);

  const handlePickByKind = (kind: 'pomodoro' | 'screen-share'): void => {
    if (!onActivitySelect) return;
    const def = findActivity(kind);
    if (def) onActivitySelect(def);
  };

  const handleLauncherSelect = (activity: ActivityDefinition): void => {
    onActivitySelect?.(activity);
  };

  return (
    <div className="grid grid-cols-4 gap-1.5 px-3 pt-3 pb-3">
      <ChunkyButton
        label="Lock in (Pomodoro)"
        icon={<Timer className="size-5" aria-hidden />}
        onClick={() => handlePickByKind('pomodoro')}
        disabled={!onActivitySelect}
      />
      <ChunkyButton
        label="Share Screen"
        icon={<ScreenShare className="size-5" aria-hidden />}
        onClick={() => handlePickByKind('screen-share')}
        disabled={!onActivitySelect}
      />
      <ChunkyButton
        label="Activities"
        icon={<Shapes className="size-5" aria-hidden />}
        onClick={() => setLauncherOpen(true)}
        disabled={!onActivitySelect}
      />
      <ChunkyButton
        label="Soundboard"
        icon={<PartyPopper className="size-5" aria-hidden />}
        onClick={() => undefined}
        disabled
      />

      {onActivitySelect ? (
        <ActivityLauncherDialog
          open={launcherOpen}
          onOpenChange={setLauncherOpen}
          onSelect={handleLauncherSelect}
        />
      ) : null}
    </div>
  );
}
