import { Loader2 } from 'lucide-react';

export function OnboardingLoader(): React.JSX.Element {
  return (
    <div className="bg-canvas flex min-h-screen items-center justify-center">
      <Loader2 className="text-ink-muted size-6 animate-spin" aria-label="Loading" />
    </div>
  );
}
