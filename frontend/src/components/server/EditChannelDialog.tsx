import { useState } from 'react';
import { Hash, Volume2, X, Settings2, Shield, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ChannelDto } from '@/queries/channels';
import { EditChannelDialogNavItem } from './EditChannelDialogNavItem';
import { EditChannelDialogOverviewPane } from './EditChannelDialogOverviewPane';
import { EditChannelDialogPlaceholderPane } from './EditChannelDialogPlaceholderPane';

type ChannelSettingsTab = 'overview' | 'permissions' | 'invites';

interface EditChannelDialogProps {
  channel: ChannelDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Discord-style channel settings dialog.
 * Two-column layout: left nav (Overview / Permissions / Invites),
 * right pane renders the active tab.
 */
export function EditChannelDialog({
  channel,
  open,
  onOpenChange,
}: EditChannelDialogProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ChannelSettingsTab>('overview');

  function handleClose() {
    onOpenChange(false);
    setActiveTab('overview');
  }

  const Icon = channel.type === 'text' ? Hash : Volume2;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        hideClose
        className="bg-surface-chrome h-[85vh] w-[85vw] max-w-4xl gap-0 overflow-hidden border-0 p-0"
      >
        <div className="flex h-full min-h-0">
          {/* ── Left nav ─────────────────────────────────────────────── */}
          <div className="bg-surface-2 flex w-56 shrink-0 flex-col px-2 py-6">
            {/* Channel name header */}
            <div className="mb-4 flex items-center gap-1.5 px-2.5">
              <Icon className="text-ink-subtle size-4 shrink-0" aria-hidden />
              <span className="text-badge text-ink-muted min-w-0 truncate font-bold tracking-wider uppercase">
                {channel.name}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <p className="text-badge text-ink-subtle mb-1 px-2.5 font-bold tracking-wider uppercase">
                Channel settings
              </p>
              <EditChannelDialogNavItem
                icon={<Settings2 className="size-4 shrink-0" />}
                label="Overview"
                active={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
              />
              <EditChannelDialogNavItem
                icon={<Shield className="size-4 shrink-0" />}
                label="Permissions"
                active={activeTab === 'permissions'}
                onClick={() => setActiveTab('permissions')}
              />
              <EditChannelDialogNavItem
                icon={<Link2 className="size-4 shrink-0" />}
                label="Invites"
                active={activeTab === 'invites'}
                onClick={() => setActiveTab('invites')}
              />
            </div>
          </div>

          {/* ── Right pane ───────────────────────────────────────────── */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto px-10 py-8">
            {/* Close button */}
            <div className="absolute top-4 right-4 flex flex-col items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClose}
                aria-label="Close channel settings"
                className="rounded-full"
              >
                <X className="size-4" />
              </Button>
              <span className="text-badge text-ink-subtle mt-1 font-bold tracking-wider">ESC</span>
            </div>

            {/* Pane title */}
            <h2 className="text-body text-ink mb-6 font-bold">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'permissions' && 'Permissions'}
              {activeTab === 'invites' && 'Invites'}
            </h2>

            {/* Active tab content */}
            {activeTab === 'overview' && (
              <EditChannelDialogOverviewPane channel={channel} onSaved={handleClose} />
            )}
            {activeTab === 'permissions' && (
              <EditChannelDialogPlaceholderPane label="Permissions" />
            )}
            {activeTab === 'invites' && <EditChannelDialogPlaceholderPane label="Invites" />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
