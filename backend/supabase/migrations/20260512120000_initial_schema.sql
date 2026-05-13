-- Wiscord — initial schema
-- Servers → Channels → Messages / Focus Sessions / Notes
-- RLS is enabled but policies live in the next migration.

-- ─── Extensions ────────────────────────────────────────────────
-- pgcrypto is enabled by default on Supabase; gen_random_uuid() comes from it.

-- ─── profiles ──────────────────────────────────────────────────
-- Public-facing user info. Mirrors auth.users via the id FK so RLS can
-- gate access without joining the auth schema.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 32),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

-- Auto-create a profile row whenever a new auth user signs up.
-- Username defaults to email's local part; user can change it later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_username text;
begin
  fallback_username := split_part(new.email, '@', 1);
  -- Disambiguate collisions by appending a short suffix.
  if exists (select 1 from public.profiles where username = fallback_username) then
    fallback_username := fallback_username || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, fallback_username, fallback_username);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh on profile edits.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ─── servers ───────────────────────────────────────────────────
-- A "server" is a community ("DSA Hub", "IELTS Prep").
create table public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 64),
  icon_url text,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index servers_owner_idx on public.servers (owner_id);


-- ─── server_members ────────────────────────────────────────────
-- Join table. Membership gates RLS on channels, messages, sessions, notes.
create table public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create index server_members_user_idx on public.server_members (user_id);

-- When a server is created, the creator becomes the owner-member automatically.
create or replace function public.handle_new_server()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.server_members (server_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_server_created
  after insert on public.servers
  for each row execute function public.handle_new_server();


-- ─── channels ──────────────────────────────────────────────────
-- Text or voice. Each text channel implicitly owns a notes doc.
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64),
  type text not null check (type in ('text', 'voice')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index channels_server_idx on public.channels (server_id, position);


-- ─── messages ──────────────────────────────────────────────────
-- Chat messages. Also serves as AI context source.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

-- Reverse-chronological fetches (last N messages in a channel).
create index messages_channel_created_idx
  on public.messages (channel_id, created_at desc);


-- ─── focus_sessions ────────────────────────────────────────────
-- Pomodoro sessions. Clients compute the countdown locally from
-- started_at + duration_minutes — we never broadcast ticks.
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  duration_minutes int not null default 25
    check (duration_minutes > 0 and duration_minutes <= 120),
  ended_at timestamptz
);

create index focus_sessions_channel_idx
  on public.focus_sessions (channel_id, started_at desc);

-- Only one active (ended_at IS NULL) session per channel at a time.
create unique index focus_sessions_one_active_per_channel
  on public.focus_sessions (channel_id)
  where ended_at is null;


-- ─── session_goals ─────────────────────────────────────────────
-- Each participant's goal for a focus session + completion state.
create table public.session_goals (
  session_id uuid not null references public.focus_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_text text not null check (char_length(goal_text) between 1 and 200),
  set_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (session_id, user_id)
);


-- ─── notes_snapshots ───────────────────────────────────────────
-- Plain-text rendering of each channel's collaborative notes doc.
-- Source of truth for the live doc is Liveblocks (Yjs); this table is
-- the queryable mirror that the AI reads as context.
-- The frontend (or a Liveblocks webhook) writes here on debounce.
create table public.notes_snapshots (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);


-- ─── invites ───────────────────────────────────────────────────
-- Short invite codes that resolve to a server. nanoid-style codes
-- generated on the client; backend just enforces uniqueness.
create table public.invites (
  code text primary key check (char_length(code) between 6 and 24),
  server_id uuid not null references public.servers(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses int check (max_uses is null or max_uses > 0),
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

create index invites_server_idx on public.invites (server_id);


-- ─── Realtime ─────────────────────────────────────────────────
-- Enable Postgres Changes (CDC) on the tables the client streams.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.focus_sessions;
alter publication supabase_realtime add table public.session_goals;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.server_members;


-- ─── Storage buckets ──────────────────────────────────────────
-- avatars: 2MB max, public read.
-- server-icons: 2MB max, public read.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('avatars', 'avatars', true, 2097152),
  ('server-icons', 'server-icons', true, 2097152)
on conflict (id) do nothing;
