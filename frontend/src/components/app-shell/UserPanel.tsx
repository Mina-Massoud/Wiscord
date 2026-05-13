import { useNavigate } from 'react-router';
import { Headphones, Mic, Settings } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PresenceDot } from './atoms/PresenceDot';

/**
 * Pinned bottom strip of the channel sidebar.
 * Shows the signed-in user's identity + voice/settings controls.
 * The settings cog opens a dropdown menu containing the sign-out action.
 */
export function UserPanel(): React.JSX.Element {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const seed = profile?.username ?? profile?.email ?? 'unknown';
  const avatarSrc = profile?.avatar_url ?? getIdenticonDataUrl(seed);
  const displayName = profile?.display_name ?? profile?.username ?? 'You';

  async function handleSignOut(): Promise<void> {
    try {
      await signOut();
      void navigate('/sign-in');
    } catch (err: unknown) {
      const message =
        err !== null &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not sign out. Please try again.';
      toast.error(message);
    }
  }

  return (
    <div className="bg-glass-callout border-glass-border h-user-panel mx-2 mb-2 flex shrink-0 items-center gap-1 rounded-lg border px-2">
      <button
        type="button"
        className="hover:bg-glass-hover flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors"
        aria-label="Open user profile (placeholder)"
        onClick={() => {
          /* static — no profile drawer in v1 */
        }}
      >
        <span className="relative shrink-0">
          <img src={avatarSrc} alt="" width={32} height={32} className="size-8 rounded-full" />
          <span className="absolute -right-0.5 -bottom-0.5">
            <PresenceDot presence="online" size={12} ringClassName="ring-glass-callout" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink text-control block truncate leading-tight font-semibold">
            {displayName}
          </span>
          <span className="text-ink-muted text-caption block truncate leading-tight">Online</span>
        </span>
      </button>

      <ControlButton label="Mute" muted>
        <Mic className="size-5" />
      </ControlButton>
      <ControlButton label="Deafen">
        <Headphones className="size-5" />
      </ControlButton>

      <DropdownMenu>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              className="text-ink-muted hover:bg-glass-hover hover:text-ink focus-visible:ring-blurple flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label="User settings"
            >
              <Settings className="size-5" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            User Settings
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuItem disabled>Account (coming soon)</DropdownMenuItem>
          <DropdownMenuItem disabled>Notifications (coming soon)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void handleSignOut();
            }}
            className="text-destructive focus:text-destructive"
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  muted?: boolean;
  children: React.ReactNode;
}

function ControlButton({ label, muted = false, children }: ControlButtonProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'flex size-8 items-center justify-center rounded-md transition-colors',
            'hover:bg-glass-hover focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
            muted ? 'text-destructive' : 'text-ink-muted hover:text-ink',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
