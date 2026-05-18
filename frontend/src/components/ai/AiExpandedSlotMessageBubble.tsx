import { type AiMessage } from '@/queries/ai';
import { Sparkles } from 'lucide-react';
import { ShimmerText } from './ShimmerText';
import { motion } from 'framer-motion';
import { CitedText } from './AiExpandedSlotCitedText';
import { ToolCallStack } from './AiExpandedSlotToolCallStack';

/**
 * Single message bubble. User bubbles right-align in a blurple
 * pill; assistant bubbles left-align with the AI logo. Citation
 * chips live under the assistant bubble that produced them so the
 * association reads cleanly even across multi-turn history.
 *
 * Pending assistant bubbles (mid-stream) show a soft shimmer on
 * the latest text via the keyed motion span — same trick the
 * legacy single-answer view used.
 */
export function MessageBubble({
  message,
  reducedMotion,
}: {
  message: AiMessage;
  reducedMotion: boolean;
}): React.JSX.Element {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-blurple/15 text-ink text-control max-w-[80%] rounded-2xl rounded-tr-md px-3 py-2 whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex items-start gap-2">
      <img
        src="/logo/ai-blob-logo.webp"
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0 rounded-full object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-ink text-control whitespace-pre-wrap">
          {message.pending && message.text.length === 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="text-ink-muted size-3 animate-pulse" aria-hidden />
              <ShimmerText>cooking…</ShimmerText>
            </span>
          ) : message.text.length === 0 && message.toolCalls.length === 0 ? (
            // Gemma 4 sometimes returns an empty content block when
            // tools are attached and no tool was picked — the assistant
            // turn lands persisted with `text: ''`. Render a fallback
            // instead of a void bubble so the user knows to retry.
            <span className="text-ink-muted italic">no answer this time — try rephrasing 🙏</span>
          ) : reducedMotion ? (
            <CitedText text={message.text} sources={message.sources} />
          ) : (
            <motion.span
              key={message.text.length}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <CitedText text={message.text} sources={message.sources} />
            </motion.span>
          )}
        </div>
        {/* Citations render inline inside the text via `CitedText` */}
        {/* now — no separate chip row under the bubble. Showing them */}
        {/* both was a duplication bug. */}
        {message.toolCalls.length > 0 ? <ToolCallStack toolCalls={message.toolCalls} /> : null}
      </div>
    </div>
  );
}
