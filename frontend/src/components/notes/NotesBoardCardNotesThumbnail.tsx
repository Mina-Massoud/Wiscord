interface NotesThumbnailProps {
  hue: number;
}

/**
 * Ruled-paper background with a soft hue blob behind it. Pure CSS, no
 * canvas — keeps the card cheap to render at any list size.
 */
export function NotesThumbnail({ hue }: NotesThumbnailProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className="relative h-32 w-full overflow-hidden"
      style={{
        backgroundImage:
          'repeating-linear-gradient(180deg, transparent 0, transparent 22px, rgba(255,255,255,0.06) 22px, rgba(255,255,255,0.06) 23px)',
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
      {/* A faint stack of placeholder text lines floating over the rules,
          so the thumbnail reads as "a written page" rather than "blank
          stationery". Widths vary deterministically by hue to keep each
          card distinct. */}
      <div className="absolute inset-0 flex flex-col gap-3 px-6 pt-6">
        <span
          className="bg-glass-border-strong h-1.5 rounded-full"
          style={{ width: `${48 + (hue % 36)}%` }}
        />
        <span
          className="bg-glass-border h-1.5 rounded-full"
          style={{ width: `${60 + (hue % 24)}%` }}
        />
        <span
          className="bg-glass-border h-1.5 rounded-full"
          style={{ width: `${36 + (hue % 32)}%` }}
        />
      </div>
    </div>
  );
}
