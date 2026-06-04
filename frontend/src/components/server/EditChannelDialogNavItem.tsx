import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface EditChannelDialogNavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function EditChannelDialogNavItem({
  icon,
  label,
  active,
  onClick,
}: EditChannelDialogNavItemProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        'text-tab h-auto w-full justify-start gap-2.5 px-2.5 py-1.5 font-medium',
        active ? 'bg-surface-active text-ink' : 'text-ink-muted hover:text-ink',
      )}
    >
      {icon}
      {label}
    </Button>
  );
}
