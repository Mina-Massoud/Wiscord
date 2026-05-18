import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { type ReactNode } from 'react';

interface ChunkyButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function ChunkyButton({
  label,
  icon,
  onClick,
  disabled = false,
}: ChunkyButtonProps): React.JSX.Element {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          disabled={disabled}
          className={cn(
            'bg-surface-1 border-glass-border hover:bg-surface-hover focus-visible:ring-blurple flex h-9 w-full items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none',
            disabled ? 'text-ink-subtle cursor-not-allowed opacity-60' : 'text-ink',
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
