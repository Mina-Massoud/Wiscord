import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import RequireAuth from '@/routes/RequireAuth';
import RequireOnboarding from '@/routes/RequireOnboarding';
import RedirectIfAuthed from '@/routes/RedirectIfAuthed';

// ---------------------------------------------------------------------------
// Route-level code splitting — each page chunk loaded on demand
// ---------------------------------------------------------------------------
const SignInPage = lazy(() => import('@/pages/sign-in/SignInPage'));
const CallbackPage = lazy(() => import('@/pages/auth/CallbackPage'));
const OnboardingLayout = lazy(() => import('@/pages/onboarding/OnboardingLayout'));
const ProfileStep = lazy(() => import('@/pages/onboarding/ProfileStep'));
const AppShellPlaceholder = lazy(() => import('@/pages/app/AppShellPlaceholder'));
const FriendsPage = lazy(() => import('@/pages/app/FriendsPage'));
const VoiceLabPage = lazy(() => import('@/pages/app/labs/VoiceLabPage'));
const QuizLabPage = lazy(() => import('@/pages/app/labs/QuizLabPage'));
const QuizIndexPage = lazy(() => import('@/pages/app/labs/QuizIndexPage'));
const WhiteboardLabPage = lazy(() => import('@/pages/app/labs/WhiteboardLabPage'));
const WhiteboardIndexPage = lazy(() => import('@/pages/app/labs/WhiteboardIndexPage'));

// ---------------------------------------------------------------------------
// Shared fallback while a lazy chunk is in flight
// ---------------------------------------------------------------------------
function RouteFallback(): React.JSX.Element {
  return (
    <div className="bg-canvas flex min-h-screen items-center justify-center">
      <Loader2 className="text-ink-muted size-6 animate-spin" aria-label="Loading" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decides where '/' should land based on live auth state
// ---------------------------------------------------------------------------
function RootRedirect(): React.JSX.Element {
  const { session, isOnboarded, isLoading } = useAuth();

  if (isLoading) return <RouteFallback />;
  if (!session) return <Navigate to="/sign-in" replace />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;

  return <Navigate to="/app" replace />;
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------
export default function App(): React.JSX.Element {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Root: smart redirect based on auth + onboarding state */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public auth screens */}
        <Route path="/sign-in" element={<RedirectIfAuthed />}>
          <Route index element={<SignInPage />} />
        </Route>
        <Route path="/auth/callback" element={<CallbackPage />} />

        {/* Onboarding (auth required; onboarding not yet required) */}
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingLayout />}>
            <Route index element={<ProfileStep />} />
          </Route>
        </Route>

        {/* App (auth + onboarded required) */}
        <Route element={<RequireAuth />}>
          <Route element={<RequireOnboarding />}>
            <Route path="/app" element={<FriendsPage />} />
            <Route path="/app/servers/:serverId" element={<AppShellPlaceholder />} />
            <Route
              path="/app/servers/:serverId/channels/:channelId"
              element={<AppShellPlaceholder />}
            />
            {/* Dev-only feature sandboxes — stripped from prod builds */}
            {import.meta.env.DEV && (
              <Route path="/app/labs/voice/:channelId" element={<VoiceLabPage />} />
            )}
            {import.meta.env.DEV && <Route path="/app/labs/quiz" element={<QuizIndexPage />} />}
            {import.meta.env.DEV && (
              <Route path="/app/labs/quiz/:channelId" element={<QuizLabPage />} />
            )}
            {import.meta.env.DEV && (
              <Route path="/app/labs/whiteboard" element={<WhiteboardIndexPage />} />
            )}
            {import.meta.env.DEV && (
              <Route path="/app/labs/whiteboard/:channelId" element={<WhiteboardLabPage />} />
            )}
          </Route>
        </Route>

        {/* Catch-all: bounce unknown paths back to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
