import { useCallback, useState } from 'react';
import { Check, Copy, Link2, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SettingsPanelTitle, SettingsSection } from '@/components/settings/SettingsShell';
import { inviteUrl } from '@/lib/invite-url';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import {
  useCreateServerInvite,
  useServerInvite,
  useServerInvites,
  type InviteDto,
} from '@/queries/invites';

interface ServerInviteDialogProps {
  serverId: string;
  serverName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InviteLinkRow({ invite, label }: { invite: InviteDto; label: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(invite.code);

  const copy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy manually?");
    }
  }, [url]);

  const usesLabel =
    invite.maxUses === 1
      ? invite.useCount >= 1
        ? 'Used'
        : 'One person'
      : 'Everyone';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-ink-muted">{label}</p>
        <span className="text-badge text-ink-muted">{usesLabel}</span>
      </div>
      <div className="flex gap-2">
        <Input readOnly value={url} className="text-caption font-mono" aria-label={label} />
        <Button type="button" variant="secondary" size="icon" onClick={() => void copy()} aria-label="Copy invite link">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Share server invites — one general link plus optional single-use links per person.
 */
export function ServerInviteDialog({
  serverId,
  serverName,
  open,
  onOpenChange,
}: ServerInviteDialogProps): React.JSX.Element {
  const defaultInvite = useServerInvite(open ? serverId : undefined);
  const allInvites = useServerInvites(open ? serverId : undefined);
  const createInvite = useCreateServerInvite(serverId);

  const personalInvites = (allInvites.data ?? []).filter((i) => i.maxUses === 1 && i.useCount < 1);

  async function onCreatePersonalInvite(): Promise<void> {
    try {
      await createInvite.mutateAsync({ maxUses: 1 });
      toast.success('Personal invite ready — send it to one person.');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        return;
      }
      toast.error("Couldn't create invite. Try again?");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-canvas max-w-md gap-0 border-0 p-0 shadow-lg">
        <div className="relative max-h-[85vh] overflow-y-auto px-10 py-14">
          <div className="absolute top-4 right-4 z-10">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <SettingsPanelTitle>Invite people</SettingsPanelTitle>
          <p className="text-ink-muted text-control mt-2">
            Share a link so anyone can join {serverName}. Personal links work for one person each.
          </p>

          <SettingsSection title="Share links">
            <div className="flex flex-col gap-4">
              {defaultInvite.isLoading ? (
                <div className="text-ink-muted flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading invite…
                </div>
              ) : null}
              {defaultInvite.isError ? (
                <p className="text-destructive text-sm">Couldn&apos;t load invite link.</p>
              ) : null}
              {defaultInvite.data ? (
                <InviteLinkRow invite={defaultInvite.data} label="General link" />
              ) : null}

              {personalInvites.length > 0 ? (
                <div className="flex flex-col gap-4 border-t border-glass-border pt-4">
                  <p className="text-subhead text-ink font-medium">Personal invites</p>
                  {personalInvites.map((invite, index) => (
                    <InviteLinkRow
                      key={invite.id}
                      invite={invite}
                      label={`Single-use link ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={createInvite.isPending}
                onClick={() => void onCreatePersonalInvite()}
              >
                {createInvite.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Link2 className="size-4" aria-hidden />
                )}
                Create link for one person
              </Button>
            </div>
          </SettingsSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
