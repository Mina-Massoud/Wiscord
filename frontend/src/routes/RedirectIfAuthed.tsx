import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/hooks/useAuth';
import { AuthCheckLoader } from './RedirectIfAuthedAuthCheckLoader';

/**
 * Route guard for public auth screens (e.g. /sign-in).
 * Redirects signed-in users to /app (onboarded) or /onboarding (not yet onboarded).
 */
export default function RedirectIfAuthed(): React.JSX.Element {
  const { session, isOnboarded, isLoading } = useAuth();

  if (isLoading) return <AuthCheckLoader />;

  if (session && isOnboarded) return <Navigate to="/app" replace />;
  if (session && !isOnboarded) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
