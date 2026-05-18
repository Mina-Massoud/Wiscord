import { useState } from 'react';
import { X, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ActivityHeaderProps {
  icon: LucideIcon;
  title: string;
  hostDisplayName: string;
  isHost: boolean;
  /**
   * Whether this activity is host-led on the server (watch/quiz). Host-led
   * + host = "End for everyone"; everything else = "Leave activity" (local
   * only). Lab kinds (notes/whiteboard) always read as `false` here.
   */
  isHostLed: boolean;
  /** Fires when the user confirms ending / leaving. */
  onLeaveActivity: () => void;
}

/**
 * The 32px strip above any non-watch activity embed. Behavior splits by
 * role × kind:
 *
 *  - Host-led + I'm host → "End for everyone" with a confirmation dialog
 *    (matches the old WatchParty end flow — ending broadcasts null and
 *    drops every viewer out of the activity).
 *  - Host-led + viewer → "Leave activity" (just local: clear my state +
 *    presence). Other viewers stay watching.
 *  - Lab kinds (notes/whiteboard) → "Leave activity" (local only).
 */
export function ActivityHeader({
  icon: Icon,
  title,
  hostDisplayName,
  isHost,
  isHostLed,
  onLeaveActivity,
}: ActivityHeaderProps): React.JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const endsForEveryone = isHostLed && isHost;

  const handleEnd = () => {
    setConfirmOpen(false);
    onLeaveActivity();
  };

  return (
    <header className="bg-glass-chrome border-glass-border flex shrink-0 items-center gap-2 border-b px-4 py-2">
      <span className="bg-blurple size-2 shrink-0 rounded-full" aria-hidden />
      <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
      <p className="text-ink-muted text-control flex min-w-0 items-baseline gap-1">
        <span className="text-ink truncate font-semibold">{title}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{isHost ? "You're hosting" : hostDisplayName}</span>
      </p>

      <div className="ml-auto">
        {endsForEveryone ? (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={`End ${title}`}
                className="text-ink-muted hover:bg-glass-hover hover:text-ink duration-fast flex size-8 items-center justify-center rounded-md transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>End {title}?</DialogTitle>
                <DialogDescription>
                  Everyone watching with you will leave the activity. You can start a new one
                  anytime.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Keep going
                </Button>
                <Button variant="destructive" onClick={handleEnd}>
                  End activity
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <button
            type="button"
            aria-label={`Leave ${title}`}
            onClick={onLeaveActivity}
            className="text-ink-muted hover:bg-glass-hover hover:text-ink duration-fast flex size-8 items-center justify-center rounded-md transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
