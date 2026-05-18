import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router';
import { RouteFallback } from './AppRouteFallback';

export function RootRedirect(): React.JSX.Element {
  const { session, isOnboarded, isLoading } = useAuth();

  if (isLoading) return <RouteFallback />;
  if (!session) return <Navigate to="/sign-in" replace />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  return <Navigate to="/app" replace />;
}
