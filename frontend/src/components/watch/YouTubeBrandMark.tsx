import { cn } from '@/lib/cn';

interface YouTubeBrandMarkProps {
  className?: string;
}

/**
 * Faithful recreation of YouTube's icon-only brand mark — red rounded
 * rectangle with the white play triangle centred. Used on the watch
 * source picker so the empty state reads as "this is YouTube"
 * immediately, instead of the muted lucide outline glyph.
 *
 * Trademark of YouTube LLC; used here only as a literal indicator of
 * YouTube content, matching the same pattern Discord uses.
 */
export function YouTubeBrandMark({ className }: YouTubeBrandMarkProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 28 20"
      role="img"
      aria-label="YouTube"
      className={cn('h-auto w-7', className)}
    >
      <path
        d="M27.4,3.1c-0.3-1.2-1.3-2.2-2.5-2.5C22.6,0,14,0,14,0S5.4,0,3.1,0.6 C1.9,0.9,0.9,1.9,0.6,3.1C0,5.4,0,10,0,10s0,4.6,0.6,6.9c0.3,1.2,1.3,2.2,2.5,2.5C5.4,20,14,20,14,20s8.6,0,10.9-0.6 c1.2-0.3,2.2-1.3,2.5-2.5C28,14.6,28,10,28,10S28,5.4,27.4,3.1z"
        fill="#FF0033"
      />
      <path d="M11.2,14.3l7.3-4.3l-7.3-4.3V14.3z" fill="#FFFFFF" />
    </svg>
  );
}
