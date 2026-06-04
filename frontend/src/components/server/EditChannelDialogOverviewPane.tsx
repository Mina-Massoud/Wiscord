import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Hash, Loader2, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import type { ChannelDto } from '@/queries/channels';
import { useUpdateChannel } from '@/queries/channels';

const editChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'At least 2 characters')
    .max(64, 'At most 64 characters')
    .regex(/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/i, 'Letters, numbers, and hyphens only'),
});

type EditChannelValues = z.infer<typeof editChannelSchema>;

interface EditChannelDialogOverviewPaneProps {
  channel: ChannelDto;
  onSaved: () => void;
}

export function EditChannelDialogOverviewPane({
  channel,
  onSaved,
}: EditChannelDialogOverviewPaneProps): React.JSX.Element {
  const updateChannel = useUpdateChannel();
  const nameInputId = useId();
  const topicId = useId();
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
      <div className="bg-surface-1 flex items-center gap-2 rounded-md px-3 py-2.5">
        <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
        <span className="text-tab text-ink-muted">
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
                <FormLabel className="text-caption text-ink-muted font-bold tracking-wider uppercase">
                  Channel name
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Icon
                      className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                      aria-hidden
                    />
                    <Input
                      {...field}
                      id={nameInputId}
                      placeholder="channel-name"
                      maxLength={64}
                      autoComplete="off"
                      disabled={isPending}
                      className="pl-9"
                      onChange={(e) => {
                        field.onChange(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }}
                    />
                  </div>
                </FormControl>
                {/* Live slug preview */}
                {slugPreview && slugPreview !== channel.name && (
                  <p className="text-caption text-ink-subtle mt-1.5">
                    Will be saved as:{' '}
                    <span className="text-ink-muted font-mono">
                      {channel.type === 'text' ? `#${slugPreview}` : slugPreview}
                    </span>
                  </p>
                )}
                <FormMessage className="text-caption" />
              </FormItem>
            )}
          />

          {/* Channel topic (display-only for now — placeholder for future) */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor={topicId}
              className="text-caption text-ink-muted font-bold tracking-wider uppercase"
            >
              Channel topic
            </label>
            <Textarea
              id={topicId}
              disabled
              placeholder="Set a topic to let people know what this channel is about…"
              className="h-20 resize-none"
            />
            <p className="text-caption text-ink-subtle">Topics coming soon.</p>
          </div>

          {/* Save row */}
          <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => form.reset({ name: channel.name })}
            >
              Reset
            </Button>
            <Button type="submit" disabled={isPending}>
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
