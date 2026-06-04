import { Hash, Volume2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/cn';
import type { ChannelType } from '@/queries/channels';

interface CreateChannelDialogChannelTypeOptionProps {
  value: ChannelType;
  label: string;
  description: string;
  selected: boolean;
}

export function CreateChannelDialogChannelTypeOption({
  value,
  label,
  description,
  selected,
}: CreateChannelDialogChannelTypeOptionProps): React.JSX.Element {
  const Icon = value === 'text' ? Hash : Volume2;
  const inputId = `channel-type-${value}`;

  return (
    <Label
      htmlFor={inputId}
      className={cn(
        'border-glass-border bg-glass-surface-2 flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors',
        selected && 'border-blurple',
      )}
    >
      <RadioGroupItem value={value} id={inputId} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-control flex items-center gap-2 font-medium">
          <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
          {label}
        </span>
        <span className="text-ink-muted text-caption">{description}</span>
      </span>
    </Label>
  );
}
