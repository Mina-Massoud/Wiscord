# Wiscord

A Discord-style collaborative study app. Topic-specific servers and channels, synchronized Pomodoros, voice lounges, shared notes, and a room-scoped AI assistant.

See [`docs/overview.md`](./docs/overview.md) for the full product spec.

## Layout

```
Wiscord/
├── docs/         # Product, stack, design, principles (shared context)
├── backend/      # Node + Express + Mongoose (currently: auth + profile only)
├── frontend/    # Vite + React + TS + Tailwind + shadcn/ui
├── scripts/     # img-to-webp.sh and other repo-wide utilities
└── .gitignore
```

- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — rules for backend work
- [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) — rules for frontend work
- [`docs/`](./docs) — product context shared by both

## Current scope

The backend was migrated off Supabase to a custom Node + Express + Mongoose stack and is currently **auth + profile only**:

- Magic-link sign-in via Resend
- HttpOnly cookie sessions (JWT, 30-day TTL by default)
- `GET / PATCH /auth/me` for the authenticated profile
- Username availability check

Server / channel / message CRUD, realtime, AI streaming, voice, and storage will be re-added in subsequent slices. The previous Supabase implementation lives under `backend/.legacy-supabase/` as the reference port target.

## Stack at a glance

- **Node + Express + TypeScript + Mongoose** — backend
- **MongoDB 8** (local via Docker, Atlas later) — database
- **jose + Resend** — JWT sessions and magic-link delivery
- **React + Vite + TypeScript + Tailwind + shadcn/ui** — frontend
- **TanStack Query + Zustand** — state management

## Quickstart

```bash
# Backend (in one terminal)
cd backend
npm install
cp .env.example .env
node -e "require('fs').appendFileSync('.env','JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex') + '\n')"
npm run db:up          # boots MongoDB on :27017 via docker compose
npm run db:seed        # optional: creates dev@wiscord.local
npm run dev            # http://localhost:3001

# Frontend (in another terminal)
cd frontend
npm install
cp .env.example .env   # already points at http://localhost:3001
npm run dev            # http://localhost:5173
```

In dev, leave `RESEND_API_KEY` empty — magic-link URLs print to the backend log so you can paste them into the browser without sending real email.

See [`docs/stack.md`](./docs/stack.md) for the full breakdown and [`docs/design.md`](./docs/design.md) for the visual system.
