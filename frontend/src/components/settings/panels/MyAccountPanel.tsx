import { getIdenticonDataUrl } from '@/lib/avatar';
import { useAuth } from '@/hooks/useAuth';
import { MediaImg } from '@/components/ui/media-img';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { DisplayNameRow } from './MyAccountPanelDisplayNameRow';
import { UsernameRow } from './MyAccountPanelUsernameRow';
import { EmailRow } from './MyAccountPanelEmailRow';
import { RoleRadio } from './MyAccountPanelRoleRadio';
import { VibeRadio } from './MyAccountPanelVibeRadio';

/**
 * My Account — identity card + inline-edit rows for the three core fields
 * the backend supports today (Display Name, Username, Email read-only). The
 * Wiscord-specific Gen Z voice radio lives at the bottom under its own
 * "Voice" subsection.
 *
 * Each row collapses back to read-only after a successful PATCH; cancelling
 * discards local edits. Username editing checks availability via the
 * existing `useUsernameAvailable` probe so the user can't submit a taken
 * handle and bounce off the server.
 */
export function MyAccountPanel(): React.JSX.Element {
  const { profile } = useAuth();
  if (!profile) return <SettingsPanelTitle>My Account</SettingsPanelTitle>;

  const seed = profile.username ?? profile.email;
  const avatarSrc = profile.avatar_url ?? getIdenticonDataUrl(seed);
  const displayName = profile.display_name ?? profile.username;

  return (
    <div>
      <SettingsPanelTitle>My Account</SettingsPanelTitle>

      {/* Identity card — banner strip + avatar + name. Discord-style flat
          surface, no border; relies on a subtle bg lift to separate it from
          the canvas. */}
      <div className="bg-surface-1 mt-6 overflow-hidden rounded-lg">
        <div className="bg-blurple/40 h-20" aria-hidden />
        <div className="flex items-center gap-4 px-5 pt-3 pb-4">
          <MediaImg
            src={avatarSrc}
            alt=""
            width={72}
            height={72}
            className="ring-surface-1 -mt-10 size-[72px] shrink-0 rounded-full ring-4"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-ink text-subhead truncate font-semibold">{displayName}</span>
            <span className="text-ink-muted text-caption truncate">@{profile.username}</span>
          </div>
        </div>

        <div className="flex flex-col px-5 pb-2">
          <DisplayNameRow current={profile.display_name} fallback={profile.username} />
          <UsernameRow current={profile.username} />
          <EmailRow email={profile.email} />
        </div>
      </div>

      <SettingsDivider />

      <SettingsSection
        title="Role"
        description="Who you are on Wiscord. Drives the recommended vibe and a few teacher-only hints."
      >
        <RoleRadio current={profile.role} />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Vibe"
        description="How Wiscord talks to you — toasts, empty states, tab labels, and the Wismate AI's voice all follow."
      >
        <VibeRadio current={profile.vibe} />
      </SettingsSection>
    </div>
  );
}
