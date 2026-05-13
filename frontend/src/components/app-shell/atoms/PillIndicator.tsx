import { cn } from '@/lib/cn';

type PillState = 'idle' | 'hover' | 'active';

interface PillIndicatorProps {
  state: PillState;
  className?: string;
}

const PILL_HEIGHT: Record<PillState, string> = {
  idle: 'h-2',
  hover: 'h-5',
  active: 'h-10',
};

/**
 * White left-edge pill that marks server-rail icons.
 * Sits at the left edge of the rail (absolute), height morphs with state.
 */
export function PillIndicator({ state, className }: PillIndicatorProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'rounded-r-pill !h-[10px] !w-[2px] bg-ink pointer-events-none absolute top-1/2 left-0 -translate-y-1/2',
        'duration-base ease-wiscord transition-all',
        state === 'idle' && 'scale-y-0 opacity-0',
        PILL_HEIGHT[state],
        className,
      )}
    />
  );
}
