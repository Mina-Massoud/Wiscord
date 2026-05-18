import { useState } from 'react';
import { Users2 } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { MusicTrack } from '@/types/music';
import { FriendPicker } from './ShareMusicPopoverFriendPicker';

interface ShareMusicPopoverProps {
  track: MusicTrack;
}

/**
 * Friend-picker for "listen together". Triggered by the Users2 icon in
 * the now-playing slot's header; opens a shadcn Popover with the user's
 * friends list. Send button posts the invite — the realtime store handles
 * the rest once the recipient accepts.
 *
 * Copy is intentionally genz per project memory `feedback_genz_language.md`.
 */
export function ShareMusicPopover({ track }: ShareMusicPopoverProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Vibe with a friend"
          className="text-ink-muted hover:text-ink"
        >
          <Users2 className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="border-glass-border w-72 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <FriendPicker track={track} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
