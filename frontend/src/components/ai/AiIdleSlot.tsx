/**
 * Idle slot for the AI capsule — the brand-logo state. Renders an
 * 18×18 logo inside the 26×26 shell, matching the music capsule's
 * idle padding so the two capsules sit next to each other with
 * identical breathing room.
 */
export function AiIdleSlot(): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img
        src="/logo/ai-blob-logo.webp"
        alt="Ask AI"
        width={18}
        height={18}
        loading="eager"
        fetchPriority="high"
        className="size-[18px] object-contain"
      />
    </div>
  );
}
