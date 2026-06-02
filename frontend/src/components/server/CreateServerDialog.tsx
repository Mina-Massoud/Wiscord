import { useCallback, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SettingsPanelTitle, SettingsSection } from '@/components/settings/SettingsShell';
import { toast } from '@/lib/toast';
import { api, ApiError } from '@/queries/client';
import { mediaUrl, useUploadMedia } from '@/queries/media';
import { firstTextChannel, type ChannelDto } from '@/queries/channels';
import { qk } from '@/queries/keys';
import { useCreateServer } from '@/queries/servers';
import { CreateServerDialogIconPicker } from './CreateServerDialogIconPicker';

const createServerSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(64, 'At most 64 characters'),
});

type CreateServerValues = z.infer<typeof createServerSchema>;

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create-server flow — uses the same `bg-canvas` dialog shell as Settings.
 * Persists via POST /servers (name + optional icon URL from storage upload).
 */
export function CreateServerDialog({ open, onOpenChange }: CreateServerDialogProps): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createServer = useCreateServer();
  const upload = useUploadMedia();
  const nameInputId = useId();

  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [iconSeed] = useState(() => `draft_${crypto.randomUUID().slice(0, 8)}`);

  const form = useForm<CreateServerValues>({
    resolver: zodResolver(createServerSchema),
    defaultValues: { name: '' },
  });

  const watchedName = form.watch('name');
  const isPending = form.formState.isSubmitting || createServer.isPending;

  const resetForm = useCallback((): void => {
    form.reset({ name: '' });
    setIconPreviewUrl(null);
  }, [form]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      resetForm();
    }
    onOpenChange(next);
  };

  function onPickFile(file: File): void {
    upload.mutate(
      { file, kind: 'image' },
      {
        onSuccess: (asset) => {
          setIconPreviewUrl(mediaUrl(asset.id));
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            toast.error(err.message);
            return;
          }
          toast.error('Upload failed. Try again?');
        },
      },
    );
  }

  async function onSubmit(values: CreateServerValues): Promise<void> {
    createServer.mutate(
      { name: values.name, iconUrl: iconPreviewUrl },
      {
        onSuccess: async (result) => {
          const { server } = result;
          let channels = result.channels;

          // Older backends may return only `{ server }` — load channels before redirect.
          if (!channels?.length) {
            try {
              const loaded = await api<{ channels: ChannelDto[] }>(
                `/servers/${server.id}/channels`,
              );
              channels = loaded.channels;
              queryClient.setQueryData(qk.channels.byServer(server.id), channels);
            } catch {
              channels = [];
            }
          }

          toast.success(`Created ${server.name}`);
          handleOpenChange(false);

          const text = firstTextChannel(channels ?? []);
          if (text) {
            void navigate(`/app/servers/${server.id}/channels/${text.id}`, { replace: true });
            return;
          }
          void navigate(`/app/servers/${server.id}`, { replace: true });
        },
        onError: (err) => {
          const message =
            err instanceof ApiError ? err.message : "Couldn't create that server. Try again?";
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
            <SettingsPanelTitle>Create your server</SettingsPanelTitle>
            <p className="text-ink-muted text-control mt-2">
              Name your study space and pick an icon — your crew will spot it in the rail.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8">
                <SettingsSection
                  title="Server icon"
                  description="Optional. Upload a square image or keep the generated icon."
                >
                  <CreateServerDialogIconPicker
                    serverName={watchedName}
                    iconPreviewUrl={iconPreviewUrl}
                    iconSeed={iconSeed}
                    isUploading={upload.isPending}
                    onPickFile={onPickFile}
                    onClearIcon={() => setIconPreviewUrl(null)}
                    onValidationError={(message) => toast.error(message)}
                  />
                </SettingsSection>

                <SettingsSection title="Server name" description="What should people call this room?">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            id={nameInputId}
                            placeholder="DSA Hub, IELTS Prep, Frontend Masters…"
                            maxLength={64}
                            autoComplete="off"
                            disabled={isPending}
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
                  <Button type="submit" disabled={isPending || upload.isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Creating…
                      </>
                    ) : (
                      'Create server'
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
