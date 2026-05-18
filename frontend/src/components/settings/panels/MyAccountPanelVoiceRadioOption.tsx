import { cn } from '@/lib/cn';

interface VoiceRadioOptionProps {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}

export function VoiceRadioOption({
  active,
  onClick,
  title,
  body,
}: VoiceRadioOptionProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors',
        active
          ? 'border-blurple bg-blurple/10'
          : 'border-glass-border bg-glass-surface-2 hover:border-glass-border-strong',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          active ? 'border-blurple' : 'border-ink-muted',
        )}
      >
        {active ? <span className="bg-blurple size-2 rounded-full" /> : null}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-ink text-control font-semibold">{title}</span>
        <span className="text-ink-muted text-caption mt-0.5">{body}</span>
      </div>
    </button>
  );
}
