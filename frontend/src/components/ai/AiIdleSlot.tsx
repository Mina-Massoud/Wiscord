/**
 * Idle slot for the AI capsule — the brand-logo state. Renders a
 * 26×26 logo centered inside the 40×40 launcher dot that floats in
 * the bottom-right corner.
 */
export function AiIdleSlot(): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img
        src="/logo/ai-blob-logo.webp"
        alt="Ask AI"
        width={26}
        height={26}
        loading="eager"
        fetchPriority="high"
        className="size-[26px] object-contain"
      />
    </div>
  );
}
