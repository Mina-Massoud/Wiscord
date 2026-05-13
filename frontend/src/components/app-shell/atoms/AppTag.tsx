import { cn } from '@/lib/cn';

interface AppTagProps {
  /** "APP" for bots, "BOT" for legacy display. Defaults to APP. */
  label?: 'APP' | 'BOT';
  className?: string;
}

/**
 * Small badge that renders next to a bot's username in chat.
 * Discord uses a blurple chip with a checkmark glyph + "APP" text.
 */
export function AppTag({ label = 'APP', className }: AppTagProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'bg-blurple inline-flex h-4 items-center gap-1 rounded-sm px-1 text-[10px] leading-none font-bold text-white uppercase select-none',
        className,
      )}
    >
      <span aria-hidden>✓</span>
      <span>{label}</span>
    </span>
  );
}
