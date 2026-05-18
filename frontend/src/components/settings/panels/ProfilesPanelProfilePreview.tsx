import { MediaImg } from '@/components/ui/media-img';

interface ProfilePreviewProps {
  name: string;
  username: string;
  avatarSrc: string;
}

export function ProfilePreview({
  name,
  username,
  avatarSrc,
}: ProfilePreviewProps): React.JSX.Element {
  return (
    <aside className="flex flex-col">
      <h3 className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
        Preview
      </h3>
      <div className="bg-glass-surface-1 border-glass-border mt-2 overflow-hidden rounded-lg border">
        <div className="bg-blurple/40 h-16" aria-hidden />
        <div className="flex flex-col items-start px-4 pt-3 pb-4">
          <MediaImg
            src={avatarSrc}
            alt=""
            width={64}
            height={64}
            className="ring-glass-surface-1 -mt-10 size-16 rounded-full ring-4"
          />
          <span className="text-ink text-subhead mt-2 font-semibold">{name}</span>
          <span className="text-ink-muted text-caption">@{username}</span>
        </div>
      </div>
    </aside>
  );
}
