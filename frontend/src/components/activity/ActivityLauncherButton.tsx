import { useState } from 'react';
import { Rocket } from 'lucide-react';

import { cn } from '@/lib/cn';
import { ActivityLauncherDialog } from './ActivityLauncherDialog';
import type { ActivityDefinition } from './ActivityRegistry';

interface ActivityLauncherButtonProps {
  /**
   * Fired when the user picks an activity from the dialog. The parent
   * decides what to do next (start a source picker, etc) — the launcher is
   * route-agnostic by design.
   */
  onActivitySelect: (activity: ActivityDefinition) => void;
  className?: string;
}

/**
 * Round trigger that opens the activity launcher dialog. Activities are
 * entered in place; this button never navigates.
 *
 * Icon is `Rocket` — literal "start something", not "AI sparkles".
 */
export function ActivityLauncherButton({
  onActivitySelect,
  className,
}: ActivityLauncherButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Start an activity"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'text-ink hover:bg-surface-hover focus-visible:ring-blurple duration-base flex size-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none',
          className,
        )}
      >
        <Rocket className="size-5" aria-hidden />
      </button>
      <ActivityLauncherDialog open={open} onOpenChange={setOpen} onSelect={onActivitySelect} />
    </>
  );
}
