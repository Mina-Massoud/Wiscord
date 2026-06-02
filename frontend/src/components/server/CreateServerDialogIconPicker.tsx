import { useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MediaImg } from '@/components/ui/media-img';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { cn } from '@/lib/cn';

const MAX_ICON_BYTES = 5 * 1024 * 1024;
const ICON_MIME = /^image\/(png|jpe?g|webp|gif)$/i;

interface CreateServerDialogIconPickerProps {
  serverName: string;
  iconPreviewUrl: string | null;
  iconSeed: string;
  isUploading: boolean;
  onPickFile: (file: File) => void;
  onClearIcon: () => void;
  onValidationError: (message: string) => void;
}

export function CreateServerDialogIconPicker({
  serverName,
  iconPreviewUrl,
  iconSeed,
  isUploading,
  onPickFile,
  onClearIcon,
  onValidationError,
}: CreateServerDialogIconPickerProps): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewSrc = iconPreviewUrl ?? getIdenticonDataUrl(iconSeed, 96);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ICON_MIME.test(file.type)) {
      onValidationError('Icon must be a PNG, JPEG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      onValidationError('Icon is too large — keep it under 5 MB.');
      return;
    }
    onPickFile(file);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line react/forbid-elements -- circular upload tile */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isUploading}
        aria-label={iconPreviewUrl ? 'Change server icon' : 'Upload server icon'}
        className={cn(
          'border-glass-border bg-glass-surface-2 relative size-24 overflow-hidden rounded-full border-2 border-dashed',
          'duration-base ease-wiscord transition-[border-color,box-shadow]',
          'hover:border-blurple focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <MediaImg
          src={previewSrc}
          alt=""
          width={96}
          height={96}
          className="size-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/40',
            iconPreviewUrl || isUploading ? 'opacity-100' : 'opacity-0',
            'duration-base ease-wiscord transition-opacity hover:opacity-100',
          )}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin text-white" aria-hidden />
          ) : (
            <ImagePlus className="size-6 text-white" aria-hidden />
          )}
        </span>
      </button>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {iconPreviewUrl ? 'Change icon' : 'Upload icon'}
        </Button>
        {iconPreviewUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearIcon} disabled={isUploading}>
            Remove
          </Button>
        ) : null}
      </div>

      <p className="text-ink-subtle text-caption text-center">
        {serverName.trim().length > 0
          ? `Preview for ${serverName.trim()}`
          : 'PNG, JPEG, WebP, or GIF — up to 5 MB.'}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
