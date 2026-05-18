import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import { toast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/queries/profile';
import { mediaUrl, useUploadMedia } from '@/queries/media';
import { ApiError } from '@/queries/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsPanelTitle } from '../SettingsShell';
import { ProfilePreview } from './ProfilesPanelProfilePreview';
import { UnsavedBar } from './ProfilesPanelUnsavedBar';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME = /^image\/(png|jpe?g|webp|gif)$/i;

/**
 * Profiles — two-column layout matching Discord. Left side has the editable
 * form, right side has a live preview card built from the same draft state.
 * Sticky save footer appears whenever the form is dirty (matches the
 * "Careful — you have unsaved changes!" pattern from Discord).
 *
 * Avatar uploads route through the existing `/storage/upload` endpoint, then
 * `PATCH /auth/me` writes the new URL. Display Name is the only text field
 * exposed for now — fancy Discord extras (pronouns, banners, profile theme,
 * about-me) need new backend columns first, called out in the plan.
 */
export function ProfilesPanel(): React.JSX.Element {
  const { profile } = useAuth();
  const update = useUpdateProfile();
  const upload = useUploadMedia();
  const fileRef = useRef<HTMLInputElement>(null);

  // Draft state mirrors the editable fields. Reset on profile change so
  // navigating between accounts doesn't strand a stale draft.
  const [draftDisplayName, setDraftDisplayName] = useState(profile?.display_name ?? '');
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);

  if (!profile) return <SettingsPanelTitle>Profiles</SettingsPanelTitle>;

  const persistedDisplayName = profile.display_name ?? '';
  const persistedAvatarUrl = profile.avatar_url ?? null;
  const dirty = draftDisplayName !== persistedDisplayName || draftAvatarUrl !== persistedAvatarUrl;
  const previewName = draftDisplayName.trim() || profile.username;
  const previewAvatar = draftAvatarUrl ?? getIdenticonDataUrl(profile.username);

  function reset(): void {
    setDraftDisplayName(persistedDisplayName);
    setDraftAvatarUrl(persistedAvatarUrl);
  }

  function save(): void {
    update.mutate(
      {
        display_name: draftDisplayName.trim().length === 0 ? null : draftDisplayName.trim(),
        avatar_url: draftAvatarUrl,
      },
      {
        onSuccess: () => toast.success('Profile saved.'),
        onError: () => toast.error("Couldn't save. Try again?"),
      },
    );
  }

  function onPickFile(): void {
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file twice re-fires
    if (!file) return;
    if (!AVATAR_MIME.test(file.type)) {
      toast.error('Avatar must be a PNG, JPEG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Avatar is too large — keep it under 5 MB.');
      return;
    }
    upload.mutate(
      { file, kind: 'image' },
      {
        onSuccess: (asset) => {
          setDraftAvatarUrl(mediaUrl(asset.id));
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

  return (
    <div className="pb-24">
      <SettingsPanelTitle>Profiles</SettingsPanelTitle>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Display name */}
          <div>
            <h3 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
              Display name
            </h3>
            <Input
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              maxLength={64}
              placeholder={profile.username}
              className="mt-2"
            />
            <p className="text-ink-subtle text-caption mt-2">
              Leave empty to fall back to your @{profile.username} handle.
            </p>
          </div>

          {/* Avatar */}
          <div>
            <h3 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
              Avatar
            </h3>
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="default"
                onClick={onPickFile}
                disabled={upload.isPending}
                className="gap-2"
              >
                {upload.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                Change Avatar
              </Button>
              {draftAvatarUrl ? (
                <button
                  type="button"
                  onClick={() => setDraftAvatarUrl(null)}
                  className="text-ink-muted hover:text-ink text-control transition-colors"
                >
                  Remove Avatar
                </button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onFileChange}
                className="hidden"
              />
            </div>
            <p className="text-ink-subtle text-caption mt-2">
              PNG, JPEG, WebP, or GIF — up to 5 MB.
            </p>
          </div>
        </div>

        {/* Live preview */}
        <ProfilePreview name={previewName} username={profile.username} avatarSrc={previewAvatar} />
      </div>

      {dirty ? (
        <UnsavedBar
          submitting={update.isPending || upload.isPending}
          onReset={reset}
          onSave={save}
        />
      ) : null}
    </div>
  );
}
