/**
 * Top-left floating wordmark that anchors the whiteboard surface so it
 * still reads as "Wiscord" once the shell is hidden in focus mode.
 * Pointer events are off so it never blocks tldraw input — it's purely
 * decorative chrome above the canvas.
 */
export function WhiteboardLogoMark(): React.JSX.Element {
  return (
    <div aria-hidden className="pointer-events-none absolute top-4 left-4 z-10 select-none">
      <img
        src="/logo/logo-text.webp"
        alt=""
        width={1066}
        height={313}
        loading="eager"
        fetchPriority="high"
        className="h-7 w-auto opacity-80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
}
