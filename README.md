# Wiscord

A Discord-style collaborative study app. Topic-specific servers and channels, synchronized Pomodoros, voice lounges, shared notes, and a room-scoped AI assistant.

See [`docs/overview.md`](./docs/overview.md) for the full product spec.

## Layout

```
Wiscord/
├── docs/         # Product, stack, design, principles (shared context)
├── backend/      # Supabase: schema, RLS, Edge Functions
├── frontend/     # Vite + React + TS + Tailwind + shadcn/ui (scaffolded later)
├── .vscode/      # Workspace settings (Deno LSP routing)
└── .gitignore
```

- [`backend/README.md`](./backend/README.md) — how to push migrations and deploy Edge Functions
- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — rules for backend work
- [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) — rules for frontend work
- [`docs/`](./docs) — product context shared by both

## Stack at a glance

- **Supabase** — Auth (magic link), Postgres, Row Level Security, Realtime, Storage, Edge Functions
- **React + Vite + TypeScript + Tailwind + shadcn/ui** — frontend
- **TanStack Query + Zustand** — state management
- **Liveblocks (Yjs)** — collaborative notes
- **LiveKit Cloud** — voice
- **Anthropic Claude Haiku 4.5** — room-scoped AI assistant (SSE streamed via Edge Function)
- **Vercel** — frontend hosting

See [`docs/stack.md`](./docs/stack.md) for the full breakdown and [`docs/design.md`](./docs/design.md) for the visual system.
