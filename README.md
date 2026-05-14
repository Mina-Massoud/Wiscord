# Wiscord

A Discord-style collaborative study app. Topic-specific servers and channels, synchronized Pomodoros, voice lounges, shared notes, a collaborative whiteboard, channel-scoped quizzes, a study calendar, and a room-scoped AI assistant.

See [`docs/overview.md`](./docs/overview.md) for the full product spec and [`docs/features-explained.md`](./docs/features-explained.md) for per-feature detail.

## Layout

```
Wiscord/
├── docs/         # Product, stack, design, principles (shared context)
├── backend/      # Node + Express + Mongoose + Socket.IO + Hocuspocus
├── frontend/     # Vite + React + TS + Tailwind + shadcn/ui
├── scripts/      # img-to-webp.sh and other repo-wide utilities
└── .gitignore
```

- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — rules for backend work
- [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) — rules for frontend work
- [`docs/`](./docs) — product context shared by both

---

## Feature status

Legend: ✅ wired end-to-end · 🟡 partial (backend or frontend only) · ⬜ planned

Tags: [DB] database · [RT] realtime · [AUTH] auth/authz · [UI] frontend · [AI] AI · [VO] voice

### Auth & onboarding

| Status | Feature | Surface |
|---|---|---|
| ✅ | Magic-link sign-in via Resend (logs URL to server in dev) | `POST /auth/magic-link`, `GET /auth/callback` |
| ✅ | HttpOnly cookie sessions (JWT, 30-day TTL) | `wiscord_session` cookie, `jose` HS256 |
| ✅ | Current-user profile read & PATCH | `GET / PATCH /auth/me` |
| ✅ | Username availability probe | `GET /auth/check-username` |
| ✅ | Sign-out clears cookie | `POST /auth/signout` |
| ✅ | Onboarding profile step (display name, username, avatar) | `/onboarding` |

### Voice lounges [VO]

| Status | Feature | Surface |
|---|---|---|
| ✅ | LiveKit room-scoped JWT minting (authz-gated) | `POST /voice/token` |
| ✅ | Participant list per channel | `GET /voice/:channelId/participants` |
| ✅ | LiveKit webhook → presence store | `POST /voice/webhook` |
| ✅ | Presence poller (fallback when webhooks are unreachable) | `livekit-presence-poller` |
| ✅ | Join / leave / mute / speaking indicator UI | `/app/labs/voice/:channelId` (DEV) |

### Notes [DB] [RT] [UI]

| Status | Feature | Surface |
|---|---|---|
| ✅ | TipTap editor (StarterKit + Link + Placeholder + markdown round-trip) | `NotesEditor` |
| ✅ | Yjs CRDT sync via Hocuspocus on shared HTTP server | `ws://…/sync/notes/:channelId` |
| ✅ | Persisted Y.Doc as `Buffer` (debounced 2s / max 10s) | `ChannelNotes` model |
| ✅ | Multi-cursor presence + deterministic per-user color | `CollaborationCaret` |
| ✅ | Last-edited-by indicator from Yjs awareness | `NotesLastEditedBy` |
| ✅ | Bubble menu on selection (bold / italic / strike / code / link) | `NotesBubbleMenu` |
| ✅ | Index + board cards listing notes by recency | `/app/labs/notes` (DEV) |
| ✅ | Delete doc — `DELETE /notes/:channelId` wipes Y.Doc | `notesRouter` |

### Whiteboard [DB] [RT] [UI]

| Status | Feature | Surface |
|---|---|---|
| ✅ | tldraw canvas themed to the glass shell (transparent + dotted grid) | `WhiteboardCanvas` |
| ✅ | `@tldraw/sync` over raw WebSocket gateway | `ws://…/sync/whiteboard/:channelId` |
| ✅ | Persisted `RoomSnapshot` (debounced 2s + 15s heartbeat ceiling) | `ChannelWhiteboard` model |
| ✅ | Multi-cursor with deterministic palette (shared with Notes) | `pickCursorColor` |
| ✅ | Custom bottom dock (Select / Pen / Eraser / Shapes / Text / Sticky / Color / Undo / Redo / Export) | `components` override |
| ✅ | Caveat hand-written font (loaded only on whiteboard routes) | `tldraw-theme.css` |
| ✅ | PNG export — transparent background, full content bounds | client-side `editor.toImage` |
| ✅ | Cold-start hydration endpoint | `GET /whiteboard/:channelId/snapshot` |
| ✅ | Clear board (confirm-gated) | `DELETE /whiteboard/:channelId` |
| ✅ | Index + board cards | `/app/labs/whiteboard` (DEV) |

### Quiz [DB] [UI]

| Status | Feature | Surface |
|---|---|---|
| ✅ | Quiz CRUD (multiple-choice, short-answer, mixed) | `POST / PATCH / DELETE /quiz/:id` |
| ✅ | Launch / close quiz lifecycle | `POST /quiz/:id/launch`, `/close` |
| ✅ | Take quiz — attempts, autosave, submit | `POST /quiz/:id/attempts`, `PATCH … /submit` |
| ✅ | Manual grading for short-answer questions | `PATCH /quiz/:id/attempts/:attemptId/grade` |
| ✅ | Per-quiz analytics (response distribution, time-to-answer) | `GET /quiz/:id/analytics` |
| ✅ | Live leaderboard | `QuizLeaderboard` |
| ✅ | Question breakdown chart | `QuizQuestionBreakdown` |
| ✅ | Index + lab routes | `/app/labs/quiz` (DEV) |

### Calendar [DB] [UI]

| Status | Feature | Surface |
|---|---|---|
| ✅ | Event CRUD (single + recurring) | `POST / PATCH / DELETE /calendar/events` |
| ✅ | "My events" feed | `GET /calendar/events/mine` |
| ✅ | Category CRUD with sensible defaults | `POST / PATCH / DELETE /calendar/categories` |
| ✅ | Realtime bridge for live event updates | `calendar/realtime-bridge.ts` |
| ✅ | Full month / week / day views | `CalendarPage`, `/app/calendar` |
| ✅ | Channel-scoped calendar lab | `/app/labs/calendar/:channelId` (DEV) |
| ✅ | E2E smoke test | `frontend/e2e/calendar.spec.ts` |

### Storage [DB] [AUTH]

| Status | Feature | Surface |
|---|---|---|
| ✅ | Media upload via Telegram MTProto as a free CDN | `POST /storage/upload` |
| ✅ | Asset metadata read | `GET /storage/:id` |
| ✅ | Asset delete (owner-gated) | `DELETE /storage/:id` |
| ✅ | Telegram client warm-up on boot (avoids 1s handshake penalty) | `warmTelegramClient` |

### Realtime infrastructure

| Status | Feature | Surface |
|---|---|---|
| ✅ | Socket.IO gateway on shared HTTP server | `modules/realtime/gateway.ts` |
| ✅ | Hocuspocus gateway for Notes | `/sync/notes/:channelId` |
| ✅ | Raw-WS gateway for Whiteboard (tldraw protocol) | `/sync/whiteboard/:channelId` |
| ✅ | Graceful shutdown — flush dirty rooms before quit | `server.ts` |

### Layout & navigation [UI]

| Status | Feature | Surface |
|---|---|---|
| ✅ | Auth-gated app shell with glass design system | `AppShellLayout` |
| ✅ | Smart root redirect (auth + onboarding state) | `App.tsx` |
| ✅ | Route-level code splitting via `React.lazy` | every page chunk |
| ✅ | Friends page placeholder | `/app` |
| ⬜ | Four-column shell (server rail / channel sidebar / main / members) | — |

---

## Coming next (planned, not yet wired)

| Feature | Notes |
|---|---|
| **Servers** — list rail, create/leave/delete, invites, settings | Top of the priority list — most other features mount inside a server scope. |
| **Channels** — text + voice channels per server, sidebar, ⌘K switcher | Voice / Notes / Whiteboard / Calendar labs collapse into the real channel route once channels lands. |
| **Chat** — send, receive, history, edit, markdown, mentions, typing, reactions | Socket.IO transport ready; the schemas + UI surface are the remaining work. |
| **Pomodoro (synchronized timer)** — start, goals, live countdown, end-check-off, break loop | Server-stamped end-time + Socket.IO ticks (clock-skew safe). |
| **Presence** — Focusing / On break / Idle, member panel, auto-status from Pomodoro | Connection lifecycle = source of truth; reuses Socket.IO room. |
| **AI Assistant (room-scoped)** — Claude Haiku via SSE, context builder, citations, prompt caching | Recent N messages + notes blob → `cache_control: { type: 'ephemeral' }` on system + context. |
| **Notifications** — per-channel unread, mention badges, opt-in chime | Rides Socket.IO + cache writes. |
| **Authz hardening** — channel/server-membership checks across every module | Replaces the per-module `requireAuth` we have today once memberships land. |
| **E2E smoke tests** — invite → join → send message → start pomodoro | Calendar already has its smoke; the rest follow the same shape. |

See [`docs/features.md`](./docs/features.md) for the canonical feature list and recommended tech per slice.

---

## Stack at a glance

- **Node + Express + TypeScript + Mongoose** — backend
- **MongoDB 8** (local via Docker, Atlas later) — database
- **Socket.IO + Hocuspocus + raw `ws`** — three realtime gateways sharing one HTTP server
- **jose + Resend** — JWT sessions and magic-link delivery
- **LiveKit Cloud** — voice (managed SFU, room-scoped JWTs)
- **Telegram MTProto** — media storage (free-tier CDN)
- **Anthropic Claude Haiku 4.5** — AI assistant (planned)
- **React 19 + Vite + TypeScript + Tailwind + shadcn/ui** — frontend
- **TanStack Query + Zustand + React Hook Form + Zod** — state and forms
- **TipTap (ProseMirror) + Yjs** — collaborative notes
- **tldraw + `@tldraw/sync`** — collaborative whiteboard

See [`docs/stack.md`](./docs/stack.md) for the full breakdown and [`docs/design.md`](./docs/design.md) for the visual system.

---

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

In dev, leave `RESEND_API_KEY` empty — magic-link URLs print to the backend log so you can paste them into the browser without sending real email. LiveKit and Telegram credentials are also optional in dev; the voice and storage paths no-op cleanly when unset.

### Dev-only lab routes

While the channel surface is still being built, individual features mount on standalone sandbox routes (stripped from prod builds):

- `/app/labs/voice/:channelId` — LiveKit join + mute + speaking indicator
- `/app/labs/notes` and `/app/labs/notes/:channelId` — TipTap + Yjs editor
- `/app/labs/whiteboard` and `/app/labs/whiteboard/:channelId` — tldraw canvas
- `/app/labs/quiz` and `/app/labs/quiz/:channelId` — quiz authoring + take + analytics
- `/app/labs/calendar` and `/app/labs/calendar/:channelId` — channel-scoped calendar
- `/app/calendar` — top-level personal calendar (ships in prod)
