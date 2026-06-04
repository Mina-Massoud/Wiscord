import { useState, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Hash, Loader2, Volume2, X, Settings2, Shield, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import type { ChannelDto } from '@/queries/channels';
import { useUpdateChannel } from '@/queries/channels';
import { cn } from '@/lib/cn';

// ── Validation ───────────────────────────────────────────────────────────────

const editChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'At least 2 characters')
    .max(64, 'At most 64 characters')
    .regex(/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/i, 'Letters, numbers, and hyphens only'),
});

type EditChannelValues = z.infer<typeof editChannelSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

type ChannelSettingsTab = 'overview' | 'permissions' | 'invites';

interface EditChannelDialogProps {
  channel: ChannelDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Nav item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-sm font-medium transition-colors',
        active
          ? 'bg-[hsl(220,8%,20%)] text-white'
          : 'text-[hsl(215,9%,65%)] hover:bg-[hsl(220,8%,16%)] hover:text-[hsl(215,9%,80%)]',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Overview pane ─────────────────────────────────────────────────────────────

interface OverviewPaneProps {
  channel: ChannelDto;
  onSaved: () => void;
}

function OverviewPane({ channel, onSaved }: OverviewPaneProps) {
  const updateChannel = useUpdateChannel();
  const nameInputId = useId();
  const Icon = channel.type === 'text' ? Hash : Volume2;

  const form = useForm<EditChannelValues>({
    resolver: zodResolver(editChannelSchema),
    defaultValues: { name: channel.name },
  });

  const watchedName = form.watch('name');
  const slugPreview = watchedName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const isPending = form.formState.isSubmitting || updateChannel.isPending;

  function onSubmit(values: EditChannelValues): void {
    const slug = values.name.trim().toLowerCase().replace(/\s+/g, '-');
    if (slug === channel.name) {
      onSaved();
      return;
    }
    updateChannel.mutate(
      { serverId: channel.serverId, channelId: channel.id, name: slug },
      {
        onSuccess: () => {
          toast.success(
            channel.type === 'text' ? `Channel renamed to #${slug}` : `Channel renamed to ${slug}`,
          );
          onSaved();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'channel_name_taken') {
            form.setError('name', { message: 'That name is already taken in this server.' });
            return;
          }
          toast.error(err instanceof ApiError ? err.message : "Couldn't save. Try again?");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Channel type badge */}
      <div className="flex items-center gap-2 rounded-md bg-[hsl(220,8%,14%)] px-3 py-2.5">
        <Icon className="size-4 text-[hsl(215,9%,55%)] shrink-0" aria-hidden />
        <span className="text-sm text-[hsl(215,9%,65%)]">
          {channel.type === 'text' ? 'Text channel' : 'Voice channel'}
        </span>
      </div>

      {/* Name field */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-[hsl(215,9%,55%)]">
                  Channel name
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Icon
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(215,9%,50%)] pointer-events-none"
                      aria-hidden
                    />
                    <Input
                      {...field}
                      id={nameInputId}
                      placeholder="channel-name"
                      maxLength={64}
                      autoComplete="off"
                      disabled={isPending}
                      className="pl-9 bg-[hsl(220,8%,10%)] border-[hsl(220,8%,20%)] text-white placeholder:text-[hsl(215,9%,40%)] focus-visible:ring-blurple"
                      onChange={(e) => {
                        field.onChange(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }}
                    />
                  </div>
                </FormControl>
                {/* Live slug preview */}
                {slugPreview && slugPreview !== channel.name && (
                  <p className="text-xs text-[hsl(215,9%,50%)] mt-1.5">
                    Will be saved as:{' '}
                    <span className="text-[hsl(215,9%,70%)] font-mono">
                      {channel.type === 'text' ? `#${slugPreview}` : slugPreview}
                    </span>
                  </p>
                )}
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Channel topic (display-only for now — placeholder for future) */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[hsl(215,9%,55%)]">
              Channel topic
            </label>
            <textarea
              disabled
              placeholder="Set a topic to let people know what this channel is about…"
              className="w-full resize-none rounded-md bg-[hsl(220,8%,10%)] border border-[hsl(220,8%,20%)] px-3 py-2 text-sm text-[hsl(215,9%,40%)] placeholder:text-[hsl(215,9%,35%)] outline-none h-20 cursor-not-allowed"
            />
            <p className="text-xs text-[hsl(215,9%,40%)]">Topics coming soon.</p>
          </div>

          {/* Save row */}
          <div className="flex items-center justify-end gap-2 border-t border-[hsl(220,8%,18%)] pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => form.reset({ name: channel.name })}
              className="text-[hsl(215,9%,65%)] hover:text-white"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blurple hover:bg-blurple/90 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ── Placeholder pane ──────────────────────────────────────────────────────────

function PlaceholderPane({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-lg border border-dashed border-[hsl(220,8%,22%)]">
      <p className="text-sm text-[hsl(215,9%,45%)]">{label} — coming soon</p>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

/**
 * Discord-style channel settings dialog.
 * Two-column layout: left nav (Overview / Permissions / Invites),
 * right pane renders the active tab.
 * Max ~490 lines incl. sub-components.
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        hideClose
        className="bg-[hsl(220,8%,11%)] h-[85vh] w-[85vw] max-w-[900px] gap-0 overflow-hidden border-0 p-0"
      >
        <div className="flex h-full min-h-0">

          {/* ── Left nav ─────────────────────────────────────────────── */}
          <div className="flex w-56 shrink-0 flex-col bg-[hsl(220,8%,8%)] px-2 py-6">
            {/* Channel name header */}
            <div className="mb-4 flex items-center gap-1.5 px-2.5">
              <Icon className="size-4 text-[hsl(215,9%,50%)] shrink-0" aria-hidden />
              <span className="min-w-0 truncate text-xs font-bold uppercase tracking-wider text-[hsl(215,9%,55%)]">
                {channel.name}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <p className="mb-1 px-2.5 text-[11px] font-bold uppercase tracking-wider text-[hsl(215,9%,45%)]">
                Channel settings
              </p>
              <NavItem
                icon={<Settings2 className="size-4 shrink-0" />}
                label="Overview"
                active={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
              />
              <NavItem
                icon={<Shield className="size-4 shrink-0" />}
                label="Permissions"
                active={activeTab === 'permissions'}
                onClick={() => setActiveTab('permissions')}
              />
              <NavItem
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
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close channel settings"
                className="flex size-9 items-center justify-center rounded-full border-2 border-[hsl(220,8%,28%)] text-[hsl(215,9%,55%)] transition-colors hover:border-[hsl(215,9%,55%)] hover:text-white"
              >
                <X className="size-4" />
              </button>
              <span className="mt-1 text-[10px] font-bold tracking-wider text-[hsl(215,9%,40%)]">ESC</span>
            </div>

            {/* Pane title */}
            <h2 className="mb-6 text-xl font-bold text-white">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'permissions' && 'Permissions'}
              {activeTab === 'invites' && 'Invites'}
            </h2>

            {/* Active tab content */}
            {activeTab === 'overview' && (
              <OverviewPane channel={channel} onSaved={handleClose} />
            )}
            {activeTab === 'permissions' && (
              <PlaceholderPane label="Permissions" />
            )}
            {activeTab === 'invites' && (
              <PlaceholderPane label="Invites" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
