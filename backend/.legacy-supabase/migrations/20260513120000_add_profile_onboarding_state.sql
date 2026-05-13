-- Wiscord — add onboarding state to profiles
-- Tracks whether a user has completed the onboarding flow (set username +
-- created or joined their first server). The frontend router checks this
-- column on session load: NULL → redirect to /onboarding, non-NULL → proceed.
--
-- RLS: no new policy needed. The existing profiles_update_self policy
-- (id = auth.uid()) already permits the authenticated user to write this
-- column on their own row.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'Timestamp the user completed the onboarding flow (profile + first server). NULL means onboarding is incomplete and the router should send them to /onboarding.';
