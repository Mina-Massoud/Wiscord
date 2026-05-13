import { Navigate, useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Safety-net route. With the cookie-based flow the backend's
 * `GET /auth/callback?token=…` already set the session cookie and 302'd
 * the user back to `/`, so this component normally never renders.
 *
 * We keep it so that an old bookmark or stale email link landing on
 * `/auth/callback` in the SPA doesn't 404 — instead we read the session
 * cache and route to the right next step.
 */
export default function CallbackPage(): React.JSX.Element {
  const { session, isOnboarded, isLoading } = useAuth();
  const [params] = useSearchParams();
  const error = params.get('error');

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" aria-label="Loading…" />
      </div>
    );
  }

  // Backend bounces here with `?error=expired_link` when the magic link
  // was already used or has timed out. Surface it on /sign-in.
  if (error) {
    return <Navigate to={`/sign-in?error=${encodeURIComponent(error)}`} replace />;
  }

  if (session === null) return <Navigate to="/sign-in" replace />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/app" replace />;
}
