import type { VibeSample } from './vibeSamples';

interface VibeStepPreviewBubbleProps {
  sample: VibeSample;
}

/**
 * Tiny two-bubble chat preview for the vibe step. Shows the user's
 * fake message and Wismate's reply in the chosen vibe so the user
 * can read the difference before committing. Static — no API call,
 * the strings live in `vibeSamples.ts`.
 *
 * Also surfaces a sample toast and button label so the user
 * understands the vibe applies everywhere, not just the AI.
 */
export function VibeStepPreviewBubble({ sample }: VibeStepPreviewBubbleProps): React.JSX.Element {
  return (
    <div className="bg-glass-surface-2 border-glass-border flex flex-col gap-3 rounded-xl border p-4">
      <span className="text-ink-muted text-badge tracking-wide uppercase">Preview</span>

      <div className="flex flex-col gap-2">
        {/* User bubble — right-aligned */}
        <div className="flex justify-end">
          <div className="bg-blurple/15 text-ink text-control max-w-[80%] rounded-2xl rounded-br-md px-3 py-2">
            {sample.bubble.user}
          </div>
        </div>
        {/* Wismate bubble — left-aligned */}
        <div className="flex justify-start">
          <div className="bg-glass-surface-1 text-ink text-control max-w-[80%] rounded-2xl rounded-bl-md px-3 py-2">
            {sample.bubble.ai}
          </div>
        </div>
      </div>

      <div className="border-glass-border flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted text-badge">Sample toast</span>
          <span className="text-ink text-caption font-medium">{sample.toast}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted text-badge">Sample button</span>
          <span className="text-ink text-caption font-medium">{sample.button}</span>
        </div>
      </div>
    </div>
  );
}
