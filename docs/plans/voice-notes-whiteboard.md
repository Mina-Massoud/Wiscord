# Mina's Plan — Voice / Notes / Whiteboard

> **Owner:** Mina
> **Drafted:** 2026-05-13
> **Status:** Starting with **Voice** only. Notes + Whiteboard remain as documented future scope.

## Context

Mina owns Voice Lounges, Shared Notes, and the Shared Whiteboard — across both frontend and backend. The channel domain (servers, channels, membership) is owned by a teammate and not yet shipped. Auth already exists (magic-link → JWT cookie), so the only true integration gap is the channel context.

The strategy: build all three features **inside the existing repo** behind dev-only `/labs/*` routes with a single stub — `channelId`, sourced from a URL param. When the channel team lands their work, the components remount inside the real channel page as tabs (Chat / Notes / Whiteboard) with no rewrites.

## Strategy

Don't build a sandbox. Build the real backend and frontend for these features inside the existing repo, on dev-only routes, with one seam:

- `useChannelId()` — reads from the route param today; reads from a `ChannelContext` provider later.

All other concerns (auth, DB, deploy) reuse the existing stack with no stubs.

## Stack alignment (current — Express-only)

- **Backend:** Node ≥20, ESM, Express 4, TypeScript, Mongoose 9 / MongoDB 8. Modules live at `backend/src/modules/<feature>/{routes,service,schemas}.ts`. Routers mount in `src/app.ts`. `requireAuth` middleware sets `req.userId`. Validation via Zod. Errors thrown as `AppError`. Responses ride the `{ success, data?, error? }` envelope via the `ok()` helper.
- **Frontend:** Vite + React 19 + TS + Tailwind v4 + shadcn/ui. Router: `react-router` v7 — route tree in `src/App.tsx`, code-split via `lazy()` + `Suspense`. Server access exclusively via `src/queries/<feature>.ts`. State: TanStack Query + Zustand. Toasts via custom `src/lib/toast.ts`.
- **No Supabase.** Legacy Supabase functions/migrations are archived under `backend/.legacy-supabase/` as porting references only.

## Channel ID convention

`uuid` (string) throughout — matches existing user IDs and what teammates will use for `channels.id`.

---

## Phase 1 — Voice (FOCUS — building now)

### 1.1 Backend `voice` module (~1.5–2h)

**Files (all new):**

```
backend/src/modules/voice/
├── routes.ts      # POST /voice/token — Zod parse, requireAuth, call service, ok() envelope
├── service.ts     # mintLivekitToken({ userId, channelId }) — builds room name, mints JWT
└── schemas.ts     # Zod: mintTokenInput = { channelId: z.string().uuid() }
```

**Service shape:**

```ts
// service.ts
export async function mintLivekitToken({
  userId,
  channelId,
}: { userId: string; channelId: string }): Promise<{
  token: string;
  livekitUrl: string;
  identity: string;
  roomName: string;
}> {
  // TODO(channel-team): once channels module exists, verify userId is a member of channelId
  // and 403 with notMember when not. For now, gate solely on requireAuth.

  const roomName = `channel:${channelId}`;
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: userId,
    ttl: '10m',
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  return {
    token: await at.toJwt(),
    livekitUrl: env.LIVEKIT_URL,
    identity: userId,
    roomName,
  };
}
```

**Wire-up:**
- Add `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` to `src/lib/env.ts` Zod schema (required in prod, optional in dev so the app still boots without them).
- Mount `voiceRouter` in `src/app.ts` after `authRouter`.
- Update `backend/.env.example` with the three LiveKit variables and a comment pointing at LiveKit Cloud signup.

**Tests (`backend/tests/voice.test.ts`):**
- Unauthenticated `POST /voice/token` → 401
- Authenticated, missing `channelId` → 400 with Zod error shape
- Authenticated, valid UUID → 200, returns `{ token, livekitUrl, identity, roomName }`, JWT decodes with the right `sub` and `room` claims
- Same channelId across two users → both get tokens with distinct `identity` but identical `room`

### 1.2 Frontend `queries/voice.ts` (~30min)

```ts
// frontend/src/queries/voice.ts
export function useVoiceToken(channelId: string) {
  return useMutation({
    mutationFn: () => api.post<VoiceTokenResponse>('/voice/token', { channelId }),
  });
}
```

- Add a hierarchical key entry to `queries/keys.ts` if the call becomes a query later (mutation for now since LiveKit tokens are short-lived and minted on-demand).
- Reuse the existing `api` client from `queries/client.ts` (sends `credentials: 'include'`).

### 1.3 Frontend dev page (~1–2h)

```
frontend/src/pages/app/labs/VoiceLabPage.tsx
```

- Route registered in `App.tsx` only when `import.meta.env.DEV`:
  ```tsx
  {import.meta.env.DEV && (
    <Route element={<RequireAuth />}>
      <Route path="/labs/voice/:channelId" element={<VoiceLabPage />} />
    </Route>
  )}
  ```
- Reads `channelId` via `useParams<{ channelId: string }>()` — exposes the same shape `useChannelId()` will return later.
- Calls `useVoiceToken(channelId)` on mount, renders three branches per the frontend rules:
  - **Loading** → shadcn `Skeleton` matching the lounge layout (participant rail + control bar)
  - **Error** → empty-state card + retry button + `toast.error("Couldn't join voice. Try again?")`
  - **Joined** → `<LiveKitRoom serverUrl={…} token={…} connect>` containing `<ParticipantTile>` grid + `<ControlBar>` from `@livekit/components-react`
- Speaking indicator and participant list come from the LiveKit components — no custom code.

**Verification:**
- `npm run db:up && npm run dev` in `backend/`, `npm run dev` in `frontend/`
- Sign in with two browsers (or one normal + one incognito) — both authed users
- Visit `http://localhost:5173/labs/voice/00000000-0000-0000-0000-000000000001` in both
- Confirm: both appear in participant list → mute reflects across windows → speaking ring lights up when one talks → leaving one window removes that participant

### 1.4 Coordination doc updates (~15min)

- Append a note to `docs/features-explained.md` (or wherever the feature backlog lives) saying voice is wired with a stubbed channel-membership check, listing the one TODO to flip when channels lands.

**Total for voice: ~4–5h.**

---

## Phase 2 — Notes (SHIPPED — 2026-05-14)

Yjs + Hocuspocus + TipTap (rich markdown editor). Mounted on the same Express HTTP server as the REST API + Socket.IO + tldraw sync. The shared HTTP server's `upgrade` event is path-dispatched: `/sync/notes/:channelId` → Hocuspocus, `/sync/whiteboard/:channelId` → tldraw, `/realtime` → Socket.IO, anything else is left for the next listener.

**Backend (`src/modules/realtime/`):**

- `notes-persistence.ts` — pure Mongo I/O. `loadNotesUpdate` / `persistNotesDoc` (upserts a `Buffer` from `Y.encodeStateAsUpdate`) / `hydrateNotesDoc` (applies stored update into a fresh `Y.Doc`). Document name scheme is `channel:{uuid}:notes`; `parseChannelIdFromDocName` validates the UUID portion.
- `notes-gateway.ts` — `startNotesSyncGateway(httpServer)` creates a `new Hocuspocus(...)` with `debounce: 2000 / maxDebounce: 10000`. The pre-handshake gate (UUID-shaped channelId, Origin === `FRONTEND_ORIGIN`, valid `wiscord_session` cookie) rejects unauthorized sockets with a clean HTTP error before the WS upgrade completes. `onAuthenticate` pins the document name to the channelId from the verified cookie path so a client can't swap to another channel's doc post-handshake. `onLoadDocument` applies the persisted update; `onStoreDocument` re-encodes the Y.Doc and upserts with `updatedBy: lastContext.userId`.
- `ChannelNotes` Mongoose model — `{ channelId (unique), ydoc: Buffer, updatedBy, timestamps }`. No plaintext mirror in v1 — the frontend serializes to markdown on demand via `tiptap-markdown` when AI / export needs it. Adding a backend mirror would require a ProseMirror schema serializer in Node, which is heavyweight for a field nothing currently reads.

**Frontend (`src/components/notes/`):**

- `NotesEditor.tsx` — TipTap `useEditor` + `HocuspocusProvider`. Extensions: `StarterKit { undoRedo: false }` (Yjs owns history), `Placeholder`, `Link`, `tiptap-markdown`, `Collaboration` (binds the Y.Doc), `CollaborationCaret` (remote cursors). The Y.Doc + provider are created in a `useMemo` keyed on `channelId` and destroyed on unmount. Awareness publishes `{ user: { id, name, color } }` so peers can render the cursor flag.
- `NotesBubbleMenu.tsx` — floating selection toolbar from `@tiptap/react/menus`. Bold / italic / strike / inline code / link only — headings and lists come from markdown shortcuts (`# `, `- `, `> `).
- `NotesLastEditedBy.tsx` + `useNotesLastEditedBy.ts` — subscribes to `provider.awareness.on('change', …)`, computes the most recent non-self user, debounced 500ms so cursor blinks don't flicker the indicator. Empty-peer transitions are immediate (no debounce) so the indicator never lies.
- `notes-prose.css` — hand-rolled node styling mapped to the glass tokens; deliberately no `@tailwindcss/typography` since its prose ramp fights every glass surface we ship.
- `NotesEmptyState.tsx` — warm intro card overlaid on an empty document.

**Index + lab routes (mirror the whiteboard structure):**

- `pages/app/labs/NotesIndexPage.tsx` at `/app/labs/notes` — hero card + grid of `NotesBoardCard` tiles + sidebar of recents. Empty / loading / error branches all match the whiteboard index so the two pages feel like siblings.
- `pages/app/labs/NotesLabPage.tsx` at `/app/labs/notes/:channelId` — single-doc editor inside the standard `AppShellLayout`. Thin wrapper; the editor owns its own header / bubble menu / footer.
- `components/notes/NotesBoardCard.tsx` — ruled-paper-pattern tile with a deterministic hue blob and three placeholder text-line bars, so the card visually reads as "a written page" without needing a real thumbnail.
- `queries/notes.ts` — `useMyNotes()` against `GET /notes/mine`; `useClearNotes(channelId)` against `DELETE /notes/:channelId`.
- Backend: `src/modules/notes/{routes,service,schemas}.ts` mounted at `/notes` in `app.ts`. `listNotesForEditor` filters `ChannelNotes` by `updatedBy === userId` and sorts by `updatedAt desc`, capped at 100.

The original "tabs in the main pane" idea (one page hosting Chat / Notes / Whiteboard tabs) was scrapped in favour of mirroring the whiteboard's index + lab structure. Once channels lands and the real channel page hosts a tab strip, the same `<NotesEditor>` component slots into the Notes tab without any rewrites.

**Tests:**

- `frontend/src/components/notes/useNotesLastEditedBy.test.ts` — 7 vitest cases (debounce trailing edge, self-exclusion, peer switching, clear-on-disconnect, unsubscribe-on-unmount). Backend integration tests for the Hocuspocus gateway are deferred until the project has a Mongo test harness — manual verification covers the round-trip in the meantime (two browsers on the lab route, edit, reload, content survives).

## Phase 3 — Whiteboard (later)

`@tldraw/tldraw` + the current tldraw Yjs sync adapter (verify the package name against tldraw docs before starting — this layer churns). Reuses the same Hocuspocus server from Phase 2, different doc name (`channel:{id}:whiteboard`). PNG export via `editor.getSvgElement()` → canvas → `toBlob()`.

## Phase 4 — Handoff to channel team

Once teammates ship the channel domain:

- Delete `/labs/voice/:channelId` (and later `/labs/notes`, `/labs/whiteboard`) from `App.tsx`.
- Mount the components inside the real channel page tabs at `/app/servers/:serverId/channels/:channelId`.
- Replace the route-param read in `useChannelId()` with `useChannelContext().channelId`.
- Flip the stubbed membership check in `voice/service.ts` (and the equivalent in `onAuthenticate` for Hocuspocus when notes/whiteboard ship) to the real `Membership.findOne({ userId, channelId })` lookup.
- Add tests for the membership-denied path.

---

## Risks

- **HIGH (Phase 2/3) — Hocuspocus on Express:** the `noServer: true` + manual `upgrade` event pattern in Node is the gotcha. Budget time for it. Not a voice-phase concern.
- **MEDIUM — LiveKit secrets:** `LIVEKIT_API_SECRET` never sees the client. Validated in `lib/env.ts`, only read inside `voice/service.ts`. The frontend gets the *minted JWT*, not the secret.
- **MEDIUM — tldraw collab adapter churn (Phase 3):** verify the current package name and store-binding API before starting Phase 3.
- **LOW — Channel ID drift:** voice service treats `channelId` as an opaque string and includes it verbatim in the room name. As long as channels eventually use UUID strings (confirmed), no migration is needed.

## Estimated complexity

| Phase | Time |
|---|---|
| 1. Voice (backend + query + dev page + tests) | 4–5h |
| 2. Notes (Hocuspocus + model + page + tests) | 5–7h |
| 3. Whiteboard (tldraw + sync + page + tests) | 4–5h |
| 4. Handoff | 1h total once channels lands |
| **Total** | **14–18h** |

## Open questions

- **LiveKit Cloud project** — Mina needs to register / supply `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`. Free tier is sufficient for MVP.
- **Channel ID UUID origin** — agreed as `uuid` strings. Confirm format with channel team before they ship migrations so the membership check joins cleanly.
