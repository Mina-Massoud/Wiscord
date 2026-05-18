import { Settings } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { useSettingsStore } from '@/lib/settings-store';
import { cn } from '@/lib/cn';
import { MediaImg } from '@/components/ui/media-img';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VoiceQuickControls } from '@/components/voice/VoiceQuickControls';
import { PresenceDot } from './atoms/PresenceDot';
import { UserPanelProBadge, useProAvatarRingClass } from './UserPanelProBadge';

interface UserPanelProps {
  /**
   * - `standalone` (default): renders with its own bordered chrome
   *   (margins, rounded card, background) — used as the pinned bottom
   *   pill on routes like FriendsPage.
   * - `inset`: drops the outer chrome so the panel can sit inside a
   *   shared container (e.g. the VoiceUserPanelGroup that stitches the
   *   "Voice Connected" card and the user identity into one card).
   */
  variant?: 'standalone' | 'inset';
}

/**
 * Pinned bottom strip of the channel sidebar.
 * Shows the signed-in user's identity + voice/settings controls.
 * The settings cog opens a dropdown menu containing the sign-out action.
 */
export function UserPanel({ variant = 'standalone' }: UserPanelProps = {}): React.JSX.Element {
  const { profile } = useAuth();
  const openSettings = useSettingsStore((s) => s.open);
  const proRingClass = useProAvatarRingClass();

  const seed = profile?.username ?? profile?.email ?? 'unknown';
  const avatarSrc = profile?.avatar_url ?? getIdenticonDataUrl(seed);
  const displayName = profile?.display_name ?? profile?.username ?? 'You';

  const containerClassName = cn(
    'h-user-panel flex shrink-0 items-center gap-1 px-2',
    variant === 'standalone' && 'bg-glass-callout border-glass-border mx-2 mb-2 rounded-lg border',
  );

  return (
    <div className={containerClassName}>
      <button
        type="button"
        className="hover:bg-glass-hover flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors"
        aria-label="Open user profile (placeholder)"
        onClick={() => {
          /* static — no profile drawer in v1 */
        }}
      >
        <span className="relative shrink-0">
          <MediaImg
            src={avatarSrc}
            alt=""
            width={32}
            height={32}
            className={cn('size-8 rounded-full', proRingClass)}
          />
          <span className="absolute -right-0.5 -bottom-0.5">
            <PresenceDot presence="online" size={12} ringClassName="ring-glass-callout" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink text-control flex min-w-0 items-center leading-tight font-semibold">
            <span className="truncate">{displayName}</span>
            <UserPanelProBadge />
          </span>
          <span className="text-ink-muted text-caption block truncate leading-tight">Online</span>
        </span>
      </button>

      <VoiceQuickControls />

      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => openSettings('myAccount')}
            className="text-ink-muted hover:bg-glass-hover hover:text-ink focus-visible:ring-blurple flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label="User settings"
          >
            <Settings className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          User Settings
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
