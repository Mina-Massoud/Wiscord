import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/hooks/useAuth';
import { OnboardingLoader } from './RequireOnboardingOnboardingLoader';

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
