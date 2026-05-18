import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import RequireAuth from '@/routes/RequireAuth';
import RequireOnboarding from '@/routes/RequireOnboarding';
import RedirectIfAuthed from '@/routes/RedirectIfAuthed';
import { ThemeGeneratorRoot } from '@/components/dev/ThemeGenerator/ThemeGeneratorRoot';
import { DynamicIsland } from '@/components/island/DynamicIsland';
import { GlobalVoiceProvider } from '@/components/voice/GlobalVoiceProvider';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { IntegrationsReturnHandler } from '@/components/settings/IntegrationsReturnHandler';
import { CheckoutReturnHandler } from '@/components/billing/CheckoutReturnHandler';
import { AiCapsule } from '@/components/ai/AiCapsule';
import { HiddenMusicPlayer } from '@/components/music/HiddenMusicPlayer';
import { MusicCapsule } from '@/components/music/MusicCapsule';
import { useApplyAppearance } from '@/lib/appearance-store';
import { useApplyThemePreset } from '@/lib/theme-preset-store';
import { useListenTogetherRealtime } from '@/queries/listen-together';
import { useListenTogetherSync } from '@/hooks/useListenTogetherSync';

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
const NotesLabPage = lazy(() => import('@/pages/app/labs/NotesLabPage'));
const NotesIndexPage = lazy(() => import('@/pages/app/labs/NotesIndexPage'));
const CalendarPage = lazy(() => import('@/pages/app/CalendarPage'));
const CalendarLabPage = lazy(() => import('@/pages/app/labs/CalendarLabPage'));
const CalendarIndexPage = lazy(() => import('@/pages/app/labs/CalendarIndexPage'));

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

// Gate the dynamic island behind auth + onboarding — pre-app surfaces
// (sign-in, magic-link callback, onboarding) shouldn't show in-app chrome.
function AuthedIsland(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <DynamicIsland />;
}

// Same scope as AuthedIsland — only an authed user can return from Stripe
// Checkout, so we only mount the handler past the auth/onboarding gate.
function AuthedCheckoutReturnHandler(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <CheckoutReturnHandler />;
}

// OAuth returns from /integrations/<provider>/callback land on
// /app?settings=integrations&connected=…|error=… — this opens the Settings
// dialog and toasts. Mounted past auth so anonymous tabs ignore the URL.
function AuthedIntegrationsReturnHandler(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <IntegrationsReturnHandler />;
}

// Music subsystem — hidden YouTube iframe audio engine + visible capsule.
// Same gating as the island: mounted only past auth/onboarding.
function AuthedMusic(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  // Subscribe to listen-together socket events at the root so invites land
  // even when the recipient is on a page that doesn't otherwise read the
  // music store. The hook is a no-op when there's no live socket.
  useListenTogetherRealtime();
  // Bridge listen-together session state to/from the music player store.
  // No-op when there's no active session.
  useListenTogetherSync();
  if (!session || !isOnboarded) return null;
  return (
    <>
      <HiddenMusicPlayer />
      <MusicCapsule />
      <AiCapsule />
    </>
  );
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------
export default function App(): React.JSX.Element {
  useApplyAppearance();
  useApplyThemePreset();
  return (
    <Suspense fallback={<RouteFallback />}>
      <ThemeGeneratorRoot />
      <AuthedIsland />
      <AuthedCheckoutReturnHandler />
      <AuthedIntegrationsReturnHandler />
      <AuthedMusic />
      <SettingsShell />
      <GlobalVoiceProvider>
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
              {import.meta.env.DEV && <Route path="/app/labs/notes" element={<NotesIndexPage />} />}
              {import.meta.env.DEV && (
                <Route path="/app/labs/notes/:channelId" element={<NotesLabPage />} />
              )}
              <Route path="/app/calendar" element={<CalendarPage />} />
              {import.meta.env.DEV && (
                <Route path="/app/labs/calendar" element={<CalendarIndexPage />} />
              )}
              {import.meta.env.DEV && (
                <Route path="/app/labs/calendar/:channelId" element={<CalendarLabPage />} />
              )}
            </Route>
          </Route>

          {/* Catch-all: bounce unknown paths back to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GlobalVoiceProvider>
    </Suspense>
  );
}
