import { useState } from 'react';
import { Lock, Monitor, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { useCurrentSession, useSignOutOtherDevices } from '@/queries/security';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';

/**
 * Security panel — v1 surfaces a single "current session" card plus a
 * destructive "sign out other devices" affordance. The backend doesn't
 * store individual sessions yet, so we don't fake a device list.
 */
export function SecurityPanel(): React.JSX.Element {
  const { data, isLoading, error } = useCurrentSession();
  const signOut = useSignOutOtherDevices();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirm(): void {
    signOut.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success('Signed out of all other devices.');
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Could not sign out other devices.';
        toast.error(message);
      },
    });
  }

  return (
    <div>
      <SettingsPanelTitle>Security</SettingsPanelTitle>

      <SettingsSection
        title="Current session"
        description="This is the device you're using right now."
      >
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : error || !data ? (
          <p className="text-destructive text-control">Couldn&apos;t load your session.</p>
        ) : (
          <div className="border-glass-border bg-glass-surface-2 flex items-start gap-3 rounded-md border px-4 py-3">
            <Monitor className="text-ink-muted size-5 shrink-0" aria-hidden />
            <div className="flex flex-col leading-tight">
              <span className="text-ink text-control font-semibold">{data.current.device}</span>
              <span className="text-ink-muted text-caption mt-0.5">
                {data.current.ipMasked} ·{' '}
                {data.current.signedInAt
                  ? `Signed in ${formatDate(data.current.signedInAt)}`
                  : 'Signed in just now'}
              </span>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Other devices"
        description="Forgot to log out on a friend's laptop? Kick everyone else off."
      >
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={signOut.isPending}
        >
          Sign out all other devices
        </Button>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Two-factor authentication"
        description="An extra layer of protection at sign-in."
      >
        <div className="border-glass-border bg-glass-surface-2 flex items-center gap-3 rounded-md border px-4 py-3 opacity-60">
          <Lock className="text-ink-muted size-5 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-ink text-control font-semibold">2FA</span>
            <span className="text-ink-muted text-caption mt-0.5">Coming soon</span>
          </div>
          <ShieldCheck className="text-ink-subtle size-4 shrink-0" aria-hidden />
        </div>
      </SettingsSection>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out everywhere else?</DialogTitle>
            <DialogDescription>
              Every other browser and device signed in to your Wiscord account will be kicked out.
              You&apos;ll stay signed in here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={signOut.isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={signOut.isPending}>
              {signOut.isPending ? 'Signing out…' : 'Sign out other devices'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
