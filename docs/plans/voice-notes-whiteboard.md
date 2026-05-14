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

## Phase 2 — Notes (later, after voice ships)

Yjs + Hocuspocus, mounted on the same Express HTTP server. Single `http.createServer` shared by Express and Hocuspocus, with the upgrade event routed by URL path. `onAuthenticate` hook validates the same `wiscord_session` cookie as the REST API.

- Backend module `src/modules/realtime/yjs.ts` (or similar) wires Hocuspocus.
- Mongoose model `ChannelNotes` stores the Yjs binary doc as `Buffer` plus an optional plaintext mirror for search/AI later.
- Frontend route `/labs/notes/:channelId` binds a `Y.Text` to a textarea; awareness payload carries `{ userId, displayName, color }` from the existing auth user; debounced server-side snapshot via Hocuspocus `onStoreDocument`.

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
