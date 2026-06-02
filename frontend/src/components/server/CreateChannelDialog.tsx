import { useCallback, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import { SettingsPanelTitle, SettingsSection } from '@/components/settings/SettingsShell';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { useCreateChannel, type ChannelType } from '@/queries/channels';
import { CreateChannelDialogChannelTypeOption } from './CreateChannelDialogChannelTypeOption';

const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'At least 2 characters')
    .max(64, 'At most 64 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Letters, numbers, and hyphens only'),
  type: z.enum(['text', 'voice']),
});

type CreateChannelValues = z.infer<typeof createChannelSchema>;

interface CreateChannelDialogProps {
  serverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select type when opened from a section + button. */
  defaultType?: ChannelType;
}

/**
 * Create-channel modal — Settings shell, channel name + text/voice radio group.
 */
export function CreateChannelDialog({
  serverId,
  open,
  onOpenChange,
  defaultType = 'text',
}: CreateChannelDialogProps): React.JSX.Element {
  const navigate = useNavigate();
  const createChannel = useCreateChannel(serverId);
  const nameInputId = useId();

  const form = useForm<CreateChannelValues>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: { name: '', type: defaultType },
  });

  const watchedType = form.watch('type');
  const isPending = form.formState.isSubmitting || createChannel.isPending;

  const resetForm = useCallback((): void => {
    form.reset({ name: '', type: defaultType });
  }, [form, defaultType]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      resetForm();
    } else {
      form.setValue('type', defaultType);
    }
    onOpenChange(next);
  };

  function onSubmit(values: CreateChannelValues): void {
    const slug = values.name.trim().toLowerCase().replace(/\s+/g, '-');
    createChannel.mutate(
      { name: slug, type: values.type },
      {
        onSuccess: (channel) => {
          toast.success(
            channel.type === 'text' ? `Created #${channel.name}` : `Created ${channel.name}`,
          );
          handleOpenChange(false);
          void navigate(`/app/servers/${serverId}/channels/${channel.id}`, { replace: true });
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'channel_name_taken') {
            form.setError('name', { message: 'That name is already taken here.' });
            return;
          }
          const message =
            err instanceof ApiError ? err.message : "Couldn't create that channel. Try again?";
          toast.error(message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className="bg-canvas gap-0 overflow-hidden border-0 p-0 sm:max-w-lg"
      >
        <div className="relative">
          <div className="absolute top-4 right-4 z-10 flex flex-col items-center">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
              className="border-glass-border text-ink-muted hover:text-ink hover:border-ink-muted flex size-9 items-center justify-center rounded-full border-2 transition-colors"
            >
              <X className="size-4" />
            </button>
            <span className="text-ink-subtle text-badge mt-1 font-bold tracking-wider">ESC</span>
          </div>

          <div className="max-h-[85vh] overflow-y-auto px-10 py-14">
            <SettingsPanelTitle>Create a channel</SettingsPanelTitle>
            <p className="text-ink-muted text-control mt-2">
              Where should your crew chat or hop into voice?
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8">
                <SettingsSection title="Channel type">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={(v) => field.onChange(v as ChannelType)}
                            className="gap-2"
                          >
                            <CreateChannelDialogChannelTypeOption
                              value="text"
                              label="Text"
                              description="Messages, notes, and study threads."
                              selected={watchedType === 'text'}
                            />
                            <CreateChannelDialogChannelTypeOption
                              value="voice"
                              label="Voice"
                              description="Audio lounge for focus blocks together."
                              selected={watchedType === 'voice'}
                            />
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsSection>

                <SettingsSection title="Channel name">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            id={nameInputId}
                            placeholder="daily-leetcode, focus-room…"
                            maxLength={64}
                            autoComplete="off"
                            disabled={isPending}
                            onChange={(e) => {
                              field.onChange(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsSection>

                <div className="mt-10 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Creating…
                      </>
                    ) : (
                      'Create channel'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
