import { Switch } from '@/components/ui/switch';

interface PrivacyToggleRowProps {
  label: string;
  body: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function PrivacyToggleRow({
  label,
  body,
  checked,
  onChange,
}: PrivacyToggleRowProps): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-surface-2 flex items-start justify-between gap-4 rounded-md border px-4 py-3">
      <div className="flex flex-col leading-tight">
        <span className="text-ink text-control font-semibold">{label}</span>
        <span className="text-ink-muted text-caption mt-1">{body}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
