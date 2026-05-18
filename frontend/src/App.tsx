import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import RequireAuth from '@/routes/RequireAuth';
import RequireOnboarding from '@/routes/RequireOnboarding';
import RedirectIfAuthed from '@/routes/RedirectIfAuthed';
import { ThemeGeneratorRoot } from '@/components/dev/ThemeGenerator/ThemeGeneratorRoot';
import { GlobalVoiceProvider } from '@/components/voice/GlobalVoiceProvider';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { useApplyAppearance } from '@/lib/appearance-store';
import { useApplyThemePreset } from '@/lib/theme-preset-store';
import { RouteFallback } from './AppRouteFallback';
import { RootRedirect } from './AppRootRedirect';
import { AuthedIsland } from './AppAuthedIsland';
import { AuthedCheckoutReturnHandler } from './AppAuthedCheckoutReturnHandler';
import { AuthedIntegrationsReturnHandler } from './AppAuthedIntegrationsReturnHandler';
import { AuthedMusic } from './AppAuthedMusic';

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

// ---------------------------------------------------------------------------
// Decides where '/' should land based on live auth state
// ---------------------------------------------------------------------------

// Gate the dynamic island behind auth + onboarding — pre-app surfaces
// (sign-in, magic-link callback, onboarding) shouldn't show in-app chrome.

// Same scope as AuthedIsland — only an authed user can return from Stripe
// Checkout, so we only mount the handler past the auth/onboarding gate.

// OAuth returns from /integrations/<provider>/callback land on
// /app?settings=integrations&connected=…|error=… — this opens the Settings
// dialog and toasts. Mounted past auth so anonymous tabs ignore the URL.

// Music subsystem — hidden YouTube iframe audio engine + visible capsule.
// Same gating as the island: mounted only past auth/onboarding.

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
