import { useState, useRef, useCallback } from 'react';
import { Settings, Trash2, Copy, BellOff, Hash } from 'lucide-react';
import { useNavigate } from 'react-router';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '@/lib/cn';
import type { ChannelDto } from '@/queries/channels';
import { useDeleteChannel } from '@/queries/channels';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { EditChannelDialog } from './EditChannelDialog';

// ── Shared menu item style ────────────────────────────────────────────────────

const itemCls =
  'flex cursor-pointer select-none items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-sm font-medium outline-none transition-colors';
const normalItem = `${itemCls} text-[hsl(214,10%,78%)] data-[highlighted]:bg-blurple data-[highlighted]:text-white`;
const dangerItem = `${itemCls} text-red-400 data-[highlighted]:bg-red-500 data-[highlighted]:text-white`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChannelRowContextMenuProps {
  channel: ChannelDto;
  serverId: string;
  isOwner: boolean;
  children: React.ReactNode;
}

/**
 * Wraps a channel row with:
 *  1. A right-click context menu (all members, Discord-style)
 *  2. Hover gear icon (owner only) → opens channel settings dialog
 */
export function ChannelRowContextMenu({
  channel,
  serverId,
  isOwner,
  children,
}: ChannelRowContextMenuProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const deleteChannel = useDeleteChannel();
  const navigate = useNavigate();

  // ── Right-click handler ──────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  function copyLink() {
    const url = `${window.location.origin}/app/servers/${serverId}/channels/${channel.id}`;
    void navigator.clipboard.writeText(url).then(() => toast.success('Channel link copied!'));
  }

  function copyId() {
    void navigator.clipboard.writeText(channel.id).then(() => toast.success('Channel ID copied!'));
  }

  function handleDelete() {
    setMenuOpen(false);
    deleteChannel.mutate(
      { serverId, channelId: channel.id },
      {
        onSuccess: () => {
          toast.success(`Deleted ${channel.type === 'text' ? '#' : ''}${channel.name}`);
          if (window.location.pathname.includes(channel.id)) {
            void navigate(`/app/servers/${serverId}`, { replace: true });
          }
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Couldn't delete channel.");
        },
      },
    );
  }

  // ── Radix virtual anchor at cursor ────────────────────────────────────────

  // const virtualAnchor: DropdownMenuPrimitive.DropdownMenuContentProps['onCloseAutoFocus'] = undefined;
  // We use a custom anchor element positioned at the cursor
  const anchorStyle: React.CSSProperties = {
    position: 'fixed',
    top: menuPos.y,
    left: menuPos.x,
    width: 1,
    height: 1,
    pointerEvents: 'none',
  };

  return (
    <>
      {/* ── Hover + right-click container ───────────────────────────── */}
      <div
        className="group relative"
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}

        {/* Hover gear button — owner only */}
        {isOwner && (
          <div
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10',
              'transition-opacity duration-100',
              hovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
          >
            <button
              type="button"
              aria-label={`Settings for ${channel.type === 'text' ? '#' : ''}${channel.name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="flex size-6 items-center justify-center rounded-[4px] bg-[hsl(220,8%,18%)] text-[hsl(215,9%,60%)] hover:bg-[hsl(220,8%,28%)] hover:text-white transition-colors"
            >
              <Settings className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* ── Context menu ─────────────────────────────────────────────── */}
      <DropdownMenuPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        {/* Virtual anchor at exact cursor position */}
        <DropdownMenuPrimitive.Trigger asChild>
          <span ref={anchorRef} style={anchorStyle} aria-hidden tabIndex={-1} />
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            loop
            align="start"
            side="bottom"
            sideOffset={0}
            onCloseAutoFocus={(e) => e.preventDefault()}
            style={{ position: 'fixed', top: menuPos.y, left: menuPos.x }}
            className="z-[200] min-w-[220px] overflow-hidden rounded-[6px] border-none bg-[hsl(220,13%,12%)] p-1.5 shadow-2xl"
          >
            {/* Owner actions */}
            {isOwner && (
              <>
                <DropdownMenuPrimitive.Item
                  className={normalItem}
                  onSelect={() => { setMenuOpen(false); setEditOpen(true); }}
                >
                  <Settings className="size-4 shrink-0" aria-hidden />
                  Edit Channel
                </DropdownMenuPrimitive.Item>

                <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[hsl(220,10%,22%)]" />
              </>
            )}

            {/* All members */}
            <DropdownMenuPrimitive.Item
              className={normalItem}
              onSelect={() => { copyLink(); setMenuOpen(false); }}
            >
              <Copy className="size-4 shrink-0" aria-hidden />
              Copy Link
            </DropdownMenuPrimitive.Item>

            <DropdownMenuPrimitive.Item
              className={normalItem}
              onSelect={() => { setMenuOpen(false); toast.success('Notifications muted.'); }}
            >
              <BellOff className="size-4 shrink-0" aria-hidden />
              Mute Channel
            </DropdownMenuPrimitive.Item>

            <DropdownMenuPrimitive.Item
              className={normalItem}
              onSelect={() => { copyId(); setMenuOpen(false); }}
            >
              <Hash className="size-4 shrink-0" aria-hidden />
              Copy Channel ID
            </DropdownMenuPrimitive.Item>

            {/* Danger — owner only */}
            {isOwner && (
              <>
                <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[hsl(220,10%,22%)]" />
                <DropdownMenuPrimitive.Item
                  className={dangerItem}
                  onSelect={handleDelete}
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden />
                  Delete Channel
                </DropdownMenuPrimitive.Item>
              </>
            )}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      {/* ── Edit channel dialog ────────────────────────────────────── */}
      {editOpen && (
        <EditChannelDialog channel={channel} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
}
