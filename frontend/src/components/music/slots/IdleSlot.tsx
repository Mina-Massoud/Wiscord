/** Brand-logo-only state. Renders before any track is loaded. */
export function IdleSlot(): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img
        src="/logo/youtube-music.webp"
        alt=""
        width={18}
        height={18}
        className="size-[18px] object-contain"
      />
    </div>
  );
}
