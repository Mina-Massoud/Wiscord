import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProfileLoadError({
  message,
  onSignOut,
}: {
  message: string;
  onSignOut: () => Promise<void>;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        className="bg-destructive/15 text-destructive flex h-12 w-12 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold">
          We couldn&apos;t load your profile
        </h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
      <Button onClick={() => void onSignOut()} className="w-full">
        Sign in again
      </Button>
    </div>
  );
}
