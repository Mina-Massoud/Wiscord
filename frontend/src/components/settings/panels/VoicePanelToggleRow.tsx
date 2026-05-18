import { Switch } from '@/components/ui/switch';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps): React.JSX.Element {
  return (
    <div className="border-glass-border flex items-start gap-4 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-control font-semibold">{label}</span>
        <span className="text-ink-muted text-caption mt-0.5">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
