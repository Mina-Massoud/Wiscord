import { cn } from '@/lib/cn';

interface BubbleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

export function BubbleButton({
  active,
  onClick,
  label,
  children,
}: BubbleButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-glass-active text-ink' : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
