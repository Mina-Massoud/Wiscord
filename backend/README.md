# Wiscord — Backend

Supabase backend for [Wiscord](../docs/overview.md), a Discord-style collaborative study app.

This folder holds: database schema, RLS policies, Edge Functions (AI proxy + LiveKit token mint), and Supabase configuration. The frontend lives in the sibling [`../frontend/`](../frontend) folder.

## Stack

- **Supabase** — Auth (magic link), Postgres, Row Level Security, Realtime, Storage, Edge Functions
- **Anthropic** — Claude Haiku 4.5 for the room-scoped AI assistant
- **LiveKit Cloud** — voice channels
- **Liveblocks** — collaborative notes (Yjs sync, called from frontend; nothing here)

See [`../docs/`](../docs) for product, stack, and design context.

## Prerequisites

1. **Node.js 18+** (for the Supabase CLI npm install — optional, you can also use Homebrew)
2. **A Supabase account** — sign up at [supabase.com](https://supabase.com) (free tier is fine)
3. **An Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)
4. **A LiveKit Cloud account** — sign up at [livekit.io/cloud](https://livekit.io/cloud) (free tier covers MVP)

## One-time setup

### 1. Install the Supabase CLI

```bash
# macOS (recommended)
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

Verify:

```bash
supabase --version
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Pick a name (e.g. `wiscord-dev`), set a database password (save it), choose a region close to you
3. Wait ~2 minutes for the project to provision
4. Copy these from **Project Settings → API**:
   - Project URL (`https://xxxxx.supabase.co`)
   - `anon` public key
   - `service_role` key (keep secret — server-side only)
5. Copy the **project ref** (the `xxxxx` part) from the URL

> Supabase recently renamed `anon` key → **publishable key** in the dashboard. They're the same thing functionally — safe to expose on the client. Use the env var name `VITE_SUPABASE_PUBLISHABLE_KEY` so future-you isn't confused.

### 3. Link this repo to your Supabase project

```bash
supabase login              # opens browser, authenticates the CLI
supabase link --project-ref <your-project-ref>
```

### 4. Push the schema + RLS policies to your project

```bash
supabase db push
```

This applies every migration in `supabase/migrations/` to your hosted Postgres.

### 5. Configure secrets for Edge Functions

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set LIVEKIT_API_KEY=API...
supabase secrets set LIVEKIT_API_SECRET=...
supabase secrets set LIVEKIT_URL=wss://your-project.livekit.cloud
```

### 6. Deploy Edge Functions

```bash
supabase functions deploy ai-ask
supabase functions deploy livekit-token
```

### 7. (Frontend) Public env vars live in `../frontend/.env.example`

The frontend folder needs **two** Supabase env vars. They're already templated in [`../frontend/.env.example`](../frontend/.env.example). When the Vite app is scaffolded, copy that to `../frontend/.env.local` and fill in the values from your Supabase project settings.

LiveKit and Liveblocks will each add one more public env var (URL / public key) when those features are wired up — not needed yet.

## Folder layout

```
backend/
├── README.md                  # this file
├── CLAUDE.md                  # backend rules
└── supabase/
    ├── config.toml            # Supabase project config
    ├── migrations/            # Versioned SQL migrations
    │   ├── 20260512120000_initial_schema.sql
    │   └── 20260512120100_rls_policies.sql
    └── functions/             # Edge Functions (Deno + TypeScript)
        ├── deno.json
        ├── tsconfig.json
        ├── types.d.ts
        ├── ai-ask/            # POST → SSE stream from Anthropic
        └── livekit-token/     # POST → signed LiveKit JWT
```

The workspace root holds shared concerns: [`../docs/`](../docs) (product context), [`../frontend/`](../frontend) (sibling app folder), `.gitignore`, `.vscode/`.

## Editor setup (one-time)

The Edge Functions in `supabase/functions/` run on **Deno**, not Node. Until you install the Deno VS Code extension, your editor will flag `npm:` imports, `.ts` extensions, and the `Deno` global as errors. They aren't — Supabase deploys them just fine.

To silence the warnings:

1. Install the **Deno** VS Code extension (`denoland.vscode-deno`) — `.vscode/extensions.json` will prompt you.
2. Reload the window. Deno's LSP picks up `supabase/functions/deno.json` automatically.
3. The rest of the repo continues to use the standard TypeScript LSP.

If you're not on VS Code, point your editor's Deno LSP at `supabase/functions/deno.json`.

## Daily workflow

```bash
# Edit schema → create a new migration
supabase migration new <descriptive_name>
# ... write SQL in the new file ...
supabase db push

# Edit an Edge Function → deploy
supabase functions deploy <function_name>

# Edit secrets
supabase secrets set KEY=value
```

## Schema overview

| Table | Purpose |
|---|---|
| `profiles` | Public user info (mirrors `auth.users`) |
| `servers` | Top-level communities ("DSA Hub", "IELTS Prep") |
| `server_members` | Membership rows (server_id, user_id) |
| `channels` | Text / voice / notes channels inside a server |
| `messages` | Chat messages (also AI context source) |
| `focus_sessions` | Pomodoro sessions per channel |
| `session_goals` | Each user's goal + completion per session |
| `notes_snapshots` | Yjs document blob per channel, persisted on debounce |
| `invites` | Invite codes that resolve to servers |

See [`supabase/migrations/00_initial_schema.sql`](./supabase/migrations/00_initial_schema.sql) for full DDL.
