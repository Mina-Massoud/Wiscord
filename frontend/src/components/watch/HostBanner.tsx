import { useState } from 'react';
import { MoreHorizontal, Radio, X } from 'lucide-react';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { describeSource } from '@/lib/watch-source';
import type { WatchActivitySnapshot } from '@/queries/client';

interface HostBannerProps {
  party: WatchActivitySnapshot;
  isHost: boolean;
  /** Display name for the host — sourced from voice presence by the parent. */
  hostDisplayName: string;
  onEndParty: () => void;
}

/**
 * The 32px strip above the player. Shows who's hosting, what's playing, and
 * surfaces the host's "end party" action through a confirmation dialog so
 * leaving isn't a single accidental click.
 *
 * The single blurple beat on this surface lives on the host indicator dot —
 * the rest of the chrome stays in the ink scale.
 */
export function HostBanner({
  party,
  isHost,
  hostDisplayName,
  onEndParty,
}: HostBannerProps): React.JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sourceLabel = party.source.title ?? describeSource(party.source);

  const handleEnd = () => {
    setConfirmOpen(false);
    onEndParty();
  };

  return (
    <header className="bg-glass-chrome border-glass-border flex items-center gap-2 border-b px-4 py-2">
      <span className="bg-blurple size-2 shrink-0 rounded-full" aria-hidden />
      <Radio className="text-ink-muted size-4 shrink-0" aria-hidden />
      <p className="text-ink-muted text-control flex min-w-0 items-baseline gap-1">
        <span className="text-ink font-semibold">
          {isHost ? "You're hosting" : hostDisplayName}
        </span>
        <span aria-hidden>·</span>
        <span className="text-subhead text-ink truncate font-semibold">{sourceLabel}</span>
      </p>

      <div className="ml-auto flex items-center gap-1">
        {isHost ? (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="End watch party"
                className="text-ink-muted hover:bg-glass-hover hover:text-ink duration-fast flex size-8 items-center justify-center rounded-md transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>End the watch party?</DialogTitle>
                <DialogDescription>
                  Everyone in the channel will leave watch mode. You can start a new one anytime.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Keep watching
                </Button>
                <Button variant="destructive" onClick={handleEnd}>
                  End party
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Party options"
              className="text-ink-muted hover:bg-glass-hover hover:text-ink duration-fast flex size-8 items-center justify-center rounded-md transition-colors"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>Copy invite link</DropdownMenuItem>
            <DropdownMenuItem disabled>Share to chat</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
