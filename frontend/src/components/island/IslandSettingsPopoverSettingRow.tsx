import { Switch } from '@/components/ui/switch';

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: SettingRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-ink text-tab font-medium">{title}</span>
        <span className="text-ink-muted text-caption">{description}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Toggle ${title} widget`}
      />
    </div>
  );
}
