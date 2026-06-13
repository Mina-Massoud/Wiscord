import { useCallback, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsPanelTitle, SettingsSection } from '@/components/settings/SettingsShell';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { mediaUrl, useUploadMedia } from '@/queries/media';
import type { ServerDto } from '@/queries/servers';
import { useUpdateServer } from '@/queries/servers';
import { CreateServerDialogIconPicker } from './CreateServerDialogIconPicker';

const editServerSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(64, 'At most 64 characters'),
});

type EditServerValues = z.infer<typeof editServerSchema>;

interface EditServerDialogProps {
  server: ServerDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edit-server modal — lets the server owner change the server name and icon.
 * Matches the visual style of CreateServerDialog.
 */
export function EditServerDialog({
  server,
  open,
  onOpenChange,
}: EditServerDialogProps): React.JSX.Element {
  const updateServer = useUpdateServer();
  const upload = useUploadMedia();
  const nameInputId = useId();

  // Start with the existing icon URL (if any)
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(server.iconUrl);
  const [isPublic, setIsPublic] = useState(server.isPublic);

  const form = useForm<EditServerValues>({
    resolver: zodResolver(editServerSchema),
    defaultValues: { name: server.name },
  });

  const watchedName = form.watch('name');
  const isPending = form.formState.isSubmitting || updateServer.isPending;

  const resetForm = useCallback((): void => {
    form.reset({ name: server.name });
    setIconPreviewUrl(server.iconUrl);
    setIsPublic(server.isPublic);
  }, [form, server.name, server.iconUrl, server.isPublic]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) resetForm();
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

  async function onSubmit(values: EditServerValues): Promise<void> {
    const nameChanged = values.name !== server.name;
    const iconChanged = iconPreviewUrl !== server.iconUrl;
    const publicChanged = isPublic !== server.isPublic;

    if (!nameChanged && !iconChanged && !publicChanged) {
      handleOpenChange(false);
      return;
    }

    updateServer.mutate(
      {
        serverId: server.id,
        ...(nameChanged ? { name: values.name } : {}),
        ...(iconChanged ? { iconUrl: iconPreviewUrl } : {}),
        ...(publicChanged ? { isPublic } : {}),
      },
      {
        onSuccess: (updated) => {
          toast.success(`"${updated.name}" updated!`);
          handleOpenChange(false);
        },
        onError: (err) => {
          const message =
            err instanceof ApiError ? err.message : "Couldn't save changes. Try again?";
          toast.error(message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideClose className="bg-canvas gap-0 overflow-hidden border-0 p-0 sm:max-w-lg">
        <div className="relative">
          {/* Close button */}
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
            <SettingsPanelTitle>Server Settings</SettingsPanelTitle>
            <p className="text-ink-muted text-control mt-2">
              Customize your server&apos;s name and icon.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8">
                <SettingsSection
                  title="Server icon"
                  description="Upload a square image or keep the current icon."
                >
                  <CreateServerDialogIconPicker
                    serverName={watchedName}
                    iconPreviewUrl={iconPreviewUrl}
                    iconSeed={server.id}
                    isUploading={upload.isPending}
                    onPickFile={onPickFile}
                    onClearIcon={() => setIconPreviewUrl(null)}
                    onValidationError={(message) => toast.error(message)}
                  />
                </SettingsSection>

                <SettingsSection
                  title="Server name"
                  description="What should people call this room?"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            id={nameInputId}
                            placeholder="Server name…"
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

                <SettingsSection
                  title="Discovery"
                  description="Public servers appear in Suggested rooms for people to find and join."
                >
                  <label className="flex items-center justify-between gap-4">
                    <span className="text-ink text-control">List this server publicly</span>
                    <Switch
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                      disabled={isPending}
                      aria-label="List this server publicly"
                    />
                  </label>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
