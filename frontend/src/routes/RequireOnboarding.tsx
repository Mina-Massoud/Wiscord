import { Loader2 } from 'lucide-react';
import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/hooks/useAuth';

function OnboardingLoader(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <Loader2 className="size-6 animate-spin text-ink-muted" aria-label="Loading" />
    </div>
  );
}

/**
 * Route guard: redirects authenticated-but-not-onboarded users to /onboarding.
 * Assumes RequireAuth has already confirmed session is non-null.
 */
export default function RequireOnboarding(): React.JSX.Element {
  const { isOnboarded, isLoading } = useAuth();

  if (isLoading) return <OnboardingLoader />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
