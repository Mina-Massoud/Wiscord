# Wiscord — Backend Rules

Project context lives in [`../docs/`](../docs). Read [`../docs/overview.md`](../docs/overview.md), [`../docs/stack.md`](../docs/stack.md), and [`../docs/principles.md`](../docs/principles.md) before making changes.

This file is the rules for the **backend** folder only (Supabase: schema, RLS, Edge Functions). Frontend rules live in [`../frontend/CLAUDE.md`](../frontend/CLAUDE.md).

---

## Shared rules (apply in both backend/ and frontend/)

### Tests are required

- Every meaningful unit of behavior gets a test
- Schema changes: write a SQL test (or at minimum a manual `psql` repro recipe in the migration's PR description) before pushing
- Edge Function logic: write a Deno test alongside (`<function>.test.ts`) for any branching beyond happy-path
- No coverage gate yet — quality of tests matters more than percentage

### Pre-commit must pass

- Husky runs on commit: SQL lint (sqlfluff or equivalent), Deno `fmt --check` + `lint` on `supabase/functions/`
- Pre-push runs the full check including any Deno tests
- CI on PR mirrors pre-push exactly

### Performance

- RLS policies must use helper functions (`is_server_member`, `is_channel_member`, `is_server_owner`) — never inline `EXISTS` joins in policy expressions (they bypass query-planner caching and cost ~5x on hot paths)
- Indexes go in the same migration as the table that needs them
- Never `SELECT *` from a function — list columns explicitly so adding a column doesn't silently widen function output

### Scope discipline

- Honor the v1 boundary in [`../docs/overview.md`](../docs/overview.md) and the single product test in [`../docs/principles.md`](../docs/principles.md)
- Don't add tables, columns, or RLS branches for features that aren't in v1

### Commit hygiene

- **Conventional commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `perf:`, `ci:` — enforced by `commitlint` (Husky)
- **Branch naming**: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>` — lowercase, hyphenated
- **No `--no-verify`, ever.** The gate exists for a reason. If a hook is wrong, fix the hook
- **No `console.log` in committed code.** In Edge Functions, `console.error` / `console.warn` is acceptable for genuine error reporting; never `console.log` for debug breadcrumbs

---

## Backend-specific rules

### Schema changes go through migrations only

- Never edit schema in the Supabase dashboard
- Every change is a new file in `supabase/migrations/`, named `YYYYMMDDHHMMSS_<descriptive_name>.sql`
- Use `supabase migration new <name>` to create the file with the correct timestamp
- **Migrations are append-only.** Once pushed, never edit a migration — write a follow-up that corrects the prior change. The migrations folder is a write-once log.
- One logical concept per migration when reasonable. Smaller migrations are easier to review and to revert by writing the inverse.

### SQL style

- Keywords lowercase: `select`, `from`, `where`, `inner join`, `create table`
- Identifiers: snake_case
- Explicit joins only — never comma-joins (`from a, b where a.id = b.a_id`)
- Column comments when behavior or invariant isn't obvious: `comment on column <table>.<col> is '...';`
- Never `select *` from a function (already in shared rules) — list columns explicitly

### RLS is mandatory on every table

- `alter table <t> enable row level security;` is part of the table's defining migration, not deferred
- Every new table gets at least a `select` policy in the same migration
- Use the helper functions (`is_server_member`, `is_channel_member`, `is_server_owner`) — don't repeat membership-check logic
- If a table needs ungated access (rare), document why in a SQL comment above the table
- **Never disable RLS, ever.** `alter table ... disable row level security` is banned. If something needs to bypass policy, write a `SECURITY DEFINER` function (see `redeem_invite` for the pattern)

### Edge Functions (Deno)

- Bare specifiers go in `supabase/functions/deno.json` `imports`; never use `npm:` directly in function code
- Don't import across function directories with `.ts` paths — inline shared helpers instead (LSP cleanliness)
- Editor-only types stay in `supabase/functions/types.d.ts`
- Every function returns proper CORS preflight handling
- Auth: validate `Authorization` header before any work; trust `supabase.auth.getUser()` only after that
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to user-facing code paths inside a function unless privilege escalation is the explicit intent

### Anthropic / AI

- Default model: `claude-haiku-4-5-20251001` for chat-context Q&A
- Always pass `system` as an array with `cache_control: { type: "ephemeral" }` on the system prompt (saves ~90% on repeated context)
- Stream responses as SSE — never wait for the full message before returning
- Cap input context (last 50 messages + notes snapshot) — don't send unbounded history
- Citations: instruct the model to use `[msg:<uuid>]` format so the frontend can render chips

### Secrets management

- No secret ever in code, in migrations, or in `.env.example`
- Backend secrets live only in `supabase secrets set ...`
- The auto-provided env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are the only ones a function should reference without explicit `supabase secrets set`
- If a secret leaks, rotate immediately — don't try to scrub git history first

### Realtime

- Postgres CDC is opt-in per table via `alter publication supabase_realtime add table <t>;` inside the migration that creates the table
- Don't enable CDC on tables that don't need it (every row update broadcasts to all subscribers — expensive)
- Use Realtime **Broadcast** channels (not CDC) for ephemeral signals (typing, cursors) — those should never hit the DB

### Storage

- Each bucket gets its own RLS policies — never expose a bucket without them
- Path convention: `<entity_id>/<filename>` so foldername-based policies work (`avatars/<uid>/...`, `server-icons/<server_id>/...`)
- File size limits set on the bucket itself, not enforced client-side only

---

## Reference

- Schema: [`supabase/migrations/20260512120000_initial_schema.sql`](./supabase/migrations/20260512120000_initial_schema.sql)
- RLS policies: [`supabase/migrations/20260512120100_rls_policies.sql`](./supabase/migrations/20260512120100_rls_policies.sql)
- AI assistant: [`supabase/functions/ai-ask/index.ts`](./supabase/functions/ai-ask/index.ts)
- LiveKit token mint: [`supabase/functions/livekit-token/index.ts`](./supabase/functions/livekit-token/index.ts)
- Frontend rules: [`../frontend/CLAUDE.md`](../frontend/CLAUDE.md)
