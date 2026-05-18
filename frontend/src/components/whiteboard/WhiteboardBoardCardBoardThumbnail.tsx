import { cn } from '@/lib/cn';

interface BoardThumbnailProps {
  hue: number;
}

/**
 * Faint dot-grid surface with a soft hue blob behind it. Pure CSS,
 * no canvas, so the card stays cheap to render at any list size.
 */
export function BoardThumbnail({ hue }: BoardThumbnailProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'relative h-32 w-full overflow-hidden',
        'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_30%,var(--tw-gradient-stops))]',
      )}
      style={{
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        backgroundColor: 'oklch(22% 0.02 280)',
      }}
    >
      <span
        className="absolute -top-10 -left-10 size-40 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: `oklch(60% 0.18 ${hue})` }}
      />
      <span
        className="absolute -right-12 -bottom-12 size-36 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: `oklch(55% 0.2 ${(hue + 140) % 360})` }}
      />
    </div>
  );
}
