import { CalendarPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface CalendarEmptyProps {
  onCreate?: () => void;
}

export function CalendarEmpty({ onCreate }: CalendarEmptyProps): React.JSX.Element {
  return (
    <div className="border-glass-border bg-glass-callout flex flex-col items-center justify-center gap-4 rounded-lg border px-8 py-16 text-center">
      <div className="bg-glass-surface-1 text-ink-muted rounded-pill flex size-12 items-center justify-center">
        <CalendarPlus className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-subhead text-ink">No events yet</p>
        <p className="text-caption text-ink-muted">
          Block out study sessions, lectures, and exam dates so they show up here.
        </p>
      </div>
      {onCreate && (
        <Button onClick={onCreate} size="sm">
          Add an event
        </Button>
      )}
    </div>
  );
}
