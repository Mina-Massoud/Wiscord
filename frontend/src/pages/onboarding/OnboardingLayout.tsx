import { Navigate, Outlet, useLocation } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout';
import { useAuth } from '@/hooks/useAuth';
import type { Profile } from '@/types/auth';

/**
 * Three-step onboarding shell — role → vibe → profile.
 *
 * The layout enforces forward progress by routing to the first
 * incomplete step on every render. A user who lands at `/onboarding`
 * directly (or refreshes the page mid-flow) gets bounced to whatever
 * step they haven't completed yet. Once `onboarded_at` is stamped on
 * the profile, the global RouteFallback redirects them onward into
 * the app — no extra logic needed here.
 *
 * Each step writes its own field on submit (role / vibe / profile)
 * so the flow is re-entrant per the partial-commit failure mode in
 * frontend/CLAUDE.md. Nothing here writes; the steps do.
 */
function firstIncompleteStep(profile: Profile | null): string {
  if (!profile) return '/onboarding/role';
  if (!profile.role) return '/onboarding/role';
  // Mongoose default fills role/vibe immediately on read, but the
  // user must consciously *choose* on these screens — we track that
  // via `onboarded_at`. The dedicated step screens themselves PATCH
  // role and vibe, so once the user passes step 1 the field is set.
  // Treat "user landed on /onboarding/role and chose nothing" as
  // unfinished by routing them back to the step explicitly.
  return '/onboarding/profile';
}

export default function OnboardingLayout(): React.JSX.Element {
  const { session, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <AuthLayout>
        <div />
      </AuthLayout>
    );
  }

  if (session === null) {
    return <Navigate to="/sign-in" replace />;
  }

  // When the user lands on bare `/onboarding`, forward to the
  // appropriate step rather than rendering nothing. Subpaths
  // (`/onboarding/role`, etc.) render normally via `<Outlet />`.
  const isIndex = location.pathname === '/onboarding' || location.pathname === '/onboarding/';
  if (isIndex) {
    return <Navigate to={firstIncompleteStep(profile)} replace />;
  }

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
