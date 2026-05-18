import { Switch } from '@/components/ui/switch';

interface ToggleRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}

export function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: ToggleRowProps): React.JSX.Element {
  return (
    <label
      htmlFor={id}
      className="hover:bg-glass-callout/40 flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors"
    >
      <span className="text-ink text-control font-medium">{label}</span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
