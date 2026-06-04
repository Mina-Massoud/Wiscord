import { ChevronDown, Settings, UserPlus, Trash2, LogOut } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { ServerDto } from '@/queries/servers';

interface ServerSettingsDropdownProps {
    server: ServerDto;
    currentUserId: string | undefined;
    onInvite: () => void;
    onEditSettings: () => void;
    onLeave: () => void;
    onDelete: () => void;
}

export function ServerSettingsDropdown({
    server,
    currentUserId,
    onInvite,
    onEditSettings,
    onLeave,
    onDelete,
}: ServerSettingsDropdownProps): React.JSX.Element {
    const isOwner = currentUserId === server.ownerId;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {/* eslint-disable-next-line react/forbid-elements -- bespoke header trigger, not button-like */}
                <button
                    type="button"
                    aria-label="Server options"
                    className={cn(
                        'flex w-full items-center justify-between gap-1 px-3 py-2',
                        'text-ink text-tab font-semibold truncate',
                        'hover:bg-surface-hover transition-colors duration-fast rounded-md',
                    )}
                >
                    <span className="min-w-0 truncate">{server.name}</span>
                    <ChevronDown className="size-4 text-ink-muted shrink-0" aria-hidden />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56">
                {/* Invites are owner-managed — only the owner can generate links. */}
                {isOwner && (
                    <DropdownMenuItem onClick={onInvite} className="gap-2">
                        <UserPlus className="size-4" aria-hidden />
                        Invite people
                    </DropdownMenuItem>
                )}

                {isOwner && (
                    <DropdownMenuItem onClick={onEditSettings} className="gap-2">
                        <Settings className="size-4" aria-hidden />
                        Server settings
                    </DropdownMenuItem>
                )}

                {isOwner && <DropdownMenuSeparator />}

                {isOwner ? (
                    <DropdownMenuItem
                        onClick={onDelete}
                        className="text-destructive focus:text-destructive gap-2"
                    >
                        <Trash2 className="size-4" aria-hidden />
                        Delete server
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        onClick={onLeave}
                        className="text-destructive focus:text-destructive gap-2"
                    >
                        <LogOut className="size-4" aria-hidden />
                        Leave server
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}