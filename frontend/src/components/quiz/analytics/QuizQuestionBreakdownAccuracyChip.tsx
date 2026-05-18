import { cn } from '@/lib/cn';

interface AccuracyChipProps {
  tone: 'success' | 'warning' | 'destructive';
  label: string;
}

export function AccuracyChip({ tone, label }: AccuracyChipProps): React.JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'bg-success/15 text-success'
      : tone === 'warning'
        ? 'bg-warning/15 text-warning'
        : 'bg-destructive/15 text-destructive';
  return (
    <span className={cn('text-badge rounded-pill shrink-0 px-2 py-0.5 font-semibold', toneClass)}>
      {label}
    </span>
  );
}
