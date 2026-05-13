-- Wiscord — Row Level Security policies
-- Every table is RLS-locked. Membership in a server gates access to that
-- server's channels and everything inside them.

-- ─── Helper functions ─────────────────────────────────────────
-- Used in policy expressions. Marked `stable` so the planner can cache
-- within a query, and `security definer` so they bypass RLS on the
-- tables they read (otherwise we'd recurse).

create or replace function public.is_server_member(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.server_members
    where server_id = p_server_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_server_owner(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.servers
    where id = p_server_id and owner_id = auth.uid()
  );
$$;

create or replace function public.is_channel_member(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.server_members sm on sm.server_id = c.server_id
    where c.id = p_channel_id and sm.user_id = auth.uid()
  );
$$;


-- ─── profiles ─────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- INSERT is handled by the on_auth_user_created trigger (security definer);
-- no direct INSERT policy needed.


-- ─── servers ──────────────────────────────────────────────────
alter table public.servers enable row level security;

create policy "servers_select_members"
  on public.servers for select
  to authenticated
  using (public.is_server_member(id));

create policy "servers_insert_own"
  on public.servers for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "servers_update_owner"
  on public.servers for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "servers_delete_owner"
  on public.servers for delete
  to authenticated
  using (owner_id = auth.uid());


-- ─── server_members ───────────────────────────────────────────
alter table public.server_members enable row level security;

create policy "server_members_select_co_members"
  on public.server_members for select
  to authenticated
  using (public.is_server_member(server_id));

-- Self-join (used for the invite redemption RPC; also for the
-- owner-auto-add trigger via security definer).
create policy "server_members_insert_self"
  on public.server_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Self-leave; owner can kick anyone in their server.
create policy "server_members_delete_self_or_owner"
  on public.server_members for delete
  to authenticated
  using (user_id = auth.uid() or public.is_server_owner(server_id));


-- ─── channels ─────────────────────────────────────────────────
alter table public.channels enable row level security;

create policy "channels_select_members"
  on public.channels for select
  to authenticated
  using (public.is_server_member(server_id));

create policy "channels_insert_owner"
  on public.channels for insert
  to authenticated
  with check (public.is_server_owner(server_id));

create policy "channels_update_owner"
  on public.channels for update
  to authenticated
  using (public.is_server_owner(server_id))
  with check (public.is_server_owner(server_id));

create policy "channels_delete_owner"
  on public.channels for delete
  to authenticated
  using (public.is_server_owner(server_id));


-- ─── messages ─────────────────────────────────────────────────
alter table public.messages enable row level security;

create policy "messages_select_members"
  on public.messages for select
  to authenticated
  using (public.is_channel_member(channel_id));

create policy "messages_insert_author_member"
  on public.messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_channel_member(channel_id)
  );

create policy "messages_update_author"
  on public.messages for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "messages_delete_author_or_server_owner"
  on public.messages for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1
      from public.channels c
      join public.servers s on s.id = c.server_id
      where c.id = messages.channel_id and s.owner_id = auth.uid()
    )
  );


-- ─── focus_sessions ───────────────────────────────────────────
alter table public.focus_sessions enable row level security;

create policy "focus_sessions_select_members"
  on public.focus_sessions for select
  to authenticated
  using (public.is_channel_member(channel_id));

create policy "focus_sessions_insert_members"
  on public.focus_sessions for insert
  to authenticated
  with check (
    started_by = auth.uid()
    and public.is_channel_member(channel_id)
  );

-- Any member can end the session (set ended_at). We don't allow other
-- column edits via RLS — Postgres won't enforce per-column on update, but
-- the client only ever PATCHes ended_at.
create policy "focus_sessions_update_members"
  on public.focus_sessions for update
  to authenticated
  using (public.is_channel_member(channel_id))
  with check (public.is_channel_member(channel_id));


-- ─── session_goals ────────────────────────────────────────────
alter table public.session_goals enable row level security;

create policy "session_goals_select_members"
  on public.session_goals for select
  to authenticated
  using (
    exists (
      select 1 from public.focus_sessions fs
      where fs.id = session_goals.session_id
        and public.is_channel_member(fs.channel_id)
    )
  );

create policy "session_goals_insert_self_member"
  on public.session_goals for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.focus_sessions fs
      where fs.id = session_id
        and public.is_channel_member(fs.channel_id)
    )
  );

create policy "session_goals_update_self"
  on public.session_goals for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "session_goals_delete_self"
  on public.session_goals for delete
  to authenticated
  using (user_id = auth.uid());


-- ─── notes_snapshots ──────────────────────────────────────────
alter table public.notes_snapshots enable row level security;

create policy "notes_snapshots_select_members"
  on public.notes_snapshots for select
  to authenticated
  using (public.is_channel_member(channel_id));

create policy "notes_snapshots_insert_members"
  on public.notes_snapshots for insert
  to authenticated
  with check (public.is_channel_member(channel_id));

create policy "notes_snapshots_update_members"
  on public.notes_snapshots for update
  to authenticated
  using (public.is_channel_member(channel_id))
  with check (public.is_channel_member(channel_id));


-- ─── invites ──────────────────────────────────────────────────
alter table public.invites enable row level security;

-- Members can see invites for their own servers (to share the link).
create policy "invites_select_members"
  on public.invites for select
  to authenticated
  using (public.is_server_member(server_id));

create policy "invites_insert_members"
  on public.invites for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_server_member(server_id)
  );

create policy "invites_delete_creator_or_owner"
  on public.invites for delete
  to authenticated
  using (created_by = auth.uid() or public.is_server_owner(server_id));


-- ─── Invite redemption (RPC) ──────────────────────────────────
-- Called by a logged-in user clicking an invite link. Validates the
-- code, adds membership, bumps use_count atomically. Bypasses RLS for
-- the lookup since the user is not yet a member.
create or replace function public.redeem_invite(p_code text)
returns uuid -- the server_id they joined
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
begin
  select * into v_invite
  from public.invites
  where code = p_code
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = '22023';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite_expired' using errcode = '22023';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite_exhausted' using errcode = '22023';
  end if;

  insert into public.server_members (server_id, user_id, role)
  values (v_invite.server_id, auth.uid(), 'member')
  on conflict (server_id, user_id) do nothing;

  update public.invites
  set use_count = use_count + 1
  where code = p_code;

  return v_invite.server_id;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;


-- ─── Storage policies ─────────────────────────────────────────
-- Avatars: any authenticated user can upload to their own folder (uid/...).
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_self"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_self"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_self"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Server icons: any authenticated user can read; only server owners can write.
create policy "server_icons_select_public"
  on storage.objects for select
  using (bucket_id = 'server-icons');

create policy "server_icons_insert_owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'server-icons'
    and public.is_server_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "server_icons_update_owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'server-icons'
    and public.is_server_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "server_icons_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'server-icons'
    and public.is_server_owner(((storage.foldername(name))[1])::uuid)
  );
