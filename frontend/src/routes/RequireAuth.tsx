import { Loader2 } from 'lucide-react';
import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/hooks/useAuth';

function AuthLoader(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <Loader2 className="size-6 animate-spin text-ink-muted" aria-label="Loading" />
    </div>
  );
}

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
