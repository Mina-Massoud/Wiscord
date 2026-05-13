import { Navigate, Outlet } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout';
import { useAuth } from '@/hooks/useAuth';

/**
 * Single-step onboarding (Profile only) — workspace setup will come back
 * once the server CRUD endpoints land. Until then onboarding completes when
 * the user submits their profile.
 */
export default function OnboardingLayout(): React.JSX.Element {
  const { session } = useAuth();

  if (session === null) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
