import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

interface QuickControlButtonProps {
  label: string;
  active?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function QuickControlButton({
  label,
  active = false,
  pending = false,
  disabled = false,
  onClick,
  children,
}: QuickControlButtonProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          aria-busy={pending}
          disabled={disabled || pending}
          onClick={onClick}
          className={cn(
            'flex size-8 items-center justify-center rounded-md transition-colors',
            'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            active
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
