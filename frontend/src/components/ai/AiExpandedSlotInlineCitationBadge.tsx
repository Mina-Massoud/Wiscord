import { type AiSource } from '@/queries/ai';
import { cn } from '@/lib/cn';

/**
 * Single inline citation pill. `display: inline-flex` so it sits
 * mid-sentence instead of as a block element. Note + event chips
 * are clickable; attempt / activity render as static labels until
 * we have an inline pane for those kinds.
 */
export function InlineCitationBadge({
  source,
  onOpen,
}: {
  source: AiSource;
  onOpen: () => void;
}): React.JSX.Element {
  const clickable =
    source.kind === 'note' ||
    source.kind === 'event' ||
    (source.kind === 'quiz' && Boolean(source.channelId));
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onOpen : undefined}
      title={source.label}
      className={cn(
        'bg-blurple/15 text-blurple text-badge mx-0.5 inline-flex max-w-[160px] items-center truncate rounded-full px-2 py-0.5 align-baseline font-medium transition-colors',
        clickable && 'hover:bg-blurple/25 cursor-pointer',
        !clickable && 'cursor-default opacity-70',
      )}
    >
      {source.label}
    </button>
  );
}
