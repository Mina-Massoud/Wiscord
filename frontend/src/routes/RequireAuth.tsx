import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/hooks/useAuth';
import { AuthLoader } from './RequireAuthAuthLoader';

/**
 * Route guard: redirects unauthenticated visitors to /sign-in.
 * Shows a centered loader while the session is being resolved.
 */
export default function RequireAuth(): React.JSX.Element {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoader />;
  if (session === null) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
