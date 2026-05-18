import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { usePrivacy, useUpdatePrivacy, type PrivacySettings } from '@/queries/privacy';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';
import { PrivacyToggleRow } from './PrivacyPanelPrivacyToggleRow';

/**
 * Privacy & Safety — three toggles that persist on the user doc. None of
 * these gate behavior yet; we store the value so the surfaces that will
 * enforce them (DM filter, friend-request gate, analytics opt-out) can
 * read a single source of truth when they land.
 */
export function PrivacyPanel(): React.JSX.Element {
  const { data, isLoading, error } = usePrivacy();
  const update = useUpdatePrivacy();

  function handleToggle(key: keyof PrivacySettings, next: boolean): void {
    update.mutate({ [key]: next } as Partial<PrivacySettings>, {
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Could not save that change.';
        toast.error(message);
      },
    });
  }

  if (isLoading) {
    return (
      <div>
        <SettingsPanelTitle>Privacy &amp; Safety</SettingsPanelTitle>
        <div className="mt-8 flex flex-col gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <SettingsPanelTitle>Privacy &amp; Safety</SettingsPanelTitle>
        <p className="text-destructive text-control mt-8">
          Couldn&apos;t load your privacy settings. Try refreshing the dialog.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SettingsPanelTitle>Privacy &amp; Safety</SettingsPanelTitle>

      <SettingsSection title="Direct messages" description="Decide who can slide into your DMs.">
        <PrivacyToggleRow
          label="Allow DMs from strangers"
          body="People outside your friends list can message you."
          checked={data.allowDmsFromStrangers}
          onChange={(v) => handleToggle('allowDmsFromStrangers', v)}
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Friend requests"
        description="Control who can send you friend requests."
      >
        <PrivacyToggleRow
          label="Allow requests from everyone"
          body="Anyone can send you a friend request. Turn off to limit to mutual friends."
          checked={data.allowFriendRequestsFromEveryone}
          onChange={(v) => handleToggle('allowFriendRequestsFromEveryone', v)}
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title="Analytics" description="Help us make Wiscord better.">
        <PrivacyToggleRow
          label="Share usage analytics"
          body="Anonymous product analytics. No message content, ever."
          checked={data.shareUsageAnalytics}
          onChange={(v) => handleToggle('shareUsageAnalytics', v)}
        />
      </SettingsSection>
    </div>
  );
}
