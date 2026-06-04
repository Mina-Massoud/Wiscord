import { useState } from 'react';
import {
  ChevronDown,
  Settings,
  UserPlus,
  LogOut,
  Trash2,
  Bell,
  Link2,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { ServerDto } from '@/queries/servers';
import { EditServerDialog } from './EditServerDialog';

interface ServerHeaderDropdownProps {
  server: ServerDto;
  currentUserId: string | undefined;
  onInvite: () => void;
}

/**
 * Discord-style dropdown that appears when the server header title is clicked.
 *
 * Owner sees: Edit Server, Invite People, Copy Link, ── Leave Server, Delete Server
 * Member sees: Invite People, Copy Link, ── Leave Server
 */
export function ServerHeaderDropdown({
  server,
  currentUserId,
  onInvite,
}: ServerHeaderDropdownProps): React.JSX.Element {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isOwner = Boolean(currentUserId && server.ownerId === currentUserId);

  function handleCopyLink(): void {
    const url = `${window.location.origin}/app/servers/${server.id}`;
    void navigator.clipboard.writeText(url).then(() => {
      // lightweight feedback — no external dependency
      const btn = document.getElementById('server-header-copy-link');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          if (btn) btn.textContent = 'Copy Server Link';
        }, 1500);
      }
    });
  }

  return (
    <>
      {/* Dropdown trigger — wraps the server name in the sidebar header */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            className={cn(
              'group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5',
              'text-ink text-tab font-semibold',
              'hover:bg-surface-hover transition-colors duration-150',
              'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
            )}
          >
            <span className="min-w-0 truncate">{server.name}</span>
            <ChevronDown
              className={cn(
                'text-ink-muted ml-auto size-4 shrink-0 transition-transform duration-200',
                dropdownOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="w-56 border-none bg-[hsl(220,13%,12%)] p-1.5 shadow-xl"
          style={{ borderRadius: '6px' }}
        >
          {/* Owner-only actions */}
          {isOwner && (
            <>
              <DropdownMenuItem
                id="server-header-edit"
                className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-[hsl(214,10%,78%)] hover:bg-blurple hover:text-white focus:bg-blurple focus:text-white"
                onSelect={() => {
                  setDropdownOpen(false);
                  setEditOpen(true);
                }}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                Edit Server
              </DropdownMenuItem>

              <DropdownMenuItem
                className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-[hsl(214,10%,78%)] hover:bg-blurple hover:text-white focus:bg-blurple focus:text-white"
                onSelect={() => {
                  setDropdownOpen(false);
                }}
              >
                <Bell className="size-4 shrink-0" aria-hidden />
                Notification Settings
              </DropdownMenuItem>
            </>
          )}

          {/* Shared actions — available to all members */}
          <DropdownMenuItem
            className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-[hsl(214,10%,78%)] hover:bg-blurple hover:text-white focus:bg-blurple focus:text-white"
            onSelect={() => {
              setDropdownOpen(false);
              onInvite();
            }}
          >
            <UserPlus className="size-4 shrink-0" aria-hidden />
            Invite People
          </DropdownMenuItem>

          <DropdownMenuItem
            id="server-header-copy-link"
            className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-[hsl(214,10%,78%)] hover:bg-blurple hover:text-white focus:bg-blurple focus:text-white"
            onSelect={(e) => {
              e.preventDefault();
              handleCopyLink();
            }}
          >
            <Link2 className="size-4 shrink-0" aria-hidden />
            Copy Server Link
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 h-px bg-[hsl(220,10%,22%)]" />

          {/* Danger zone */}
          <DropdownMenuItem
            className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-red-400 hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white"
            onSelect={() => {
              setDropdownOpen(false);
            }}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Leave Server
          </DropdownMenuItem>

          {isOwner && (
            <DropdownMenuItem
              className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-sm font-medium text-red-400 hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white"
              onSelect={() => {
                setDropdownOpen(false);
              }}
            >
              <Trash2 className="size-4 shrink-0" aria-hidden />
              Delete Server
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit server dialog */}
      <EditServerDialog server={server} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
