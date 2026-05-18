import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/hooks/useAuth';
import { AuthLoader } from './RequireAuthAuthLoader';

/**
 * Route guard: redirects unauthenticated visitors to /sign-in.
 * Shows a centered loader while the session is being resolved.
 */
export default function RequireAuth(): React.JSX.Element {
  const { session, isLoading } = useAuth();

  if (isLoading) return <AuthLoader />;
  if (session === null) return <Navigate to="/sign-in" replace />;

  return <Outlet />;
}
