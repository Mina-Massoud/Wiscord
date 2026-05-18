# Voice & activity persistence across routes

This doc explains a bug we hit, why it happened, and the pattern we used
to fix it. The pattern generalises — if you ever need *anything* to
"keep running" while the user navigates around the app, read this first.

---

## The bug

> "I joined a voice channel, then clicked on the calendar in the sidebar.
> The call dropped. Discord doesn't do that."

The user expected Discord-style behaviour: once you're on a call, you
stay on the call until you explicitly leave. Navigating to another
route should be silent — your mic stays open, your audio keeps playing,
the activity you're in (notes / whiteboard / watch party) keeps running.

What was actually happening: clicking `/app/calendar` while in voice
disconnected the call, dropped the activity, and left the user staring
at a page with no indication anything had been lost.

---

## Why it happened

The voice page (`VoiceLabPage`) owned the `<LiveKitRoom>` component:

```tsx
// BEFORE — VoiceLabPage.tsx
export default function VoiceLabPage() {
  return (
    <LiveKitRoom token={...} connect={wantConnected} ...>
      <AppShellLayout main={<VoiceMainPane ... />} ... />
    </LiveKitRoom>
  );
}
```

This is the natural way to write a feature page — the component that
*needs* the room is the one that *mounts* the room. But it has a
critical side effect.

**React unmounts every component on a route change.** When the user
navigated from `/app/labs/voice/abc` to `/app/calendar`, React saw a
different route, unmounted `VoiceLabPage`, which unmounted
`<LiveKitRoom>`, which called `room.disconnect()` in its cleanup. The
peer connection closed. The mic was released. The activity state was
gone.

The mental model trap: **a component's lifetime is its position in the
React tree, not the user's intent.** If you mount a long-lived thing
inside a short-lived component, the long-lived thing dies the moment
the short-lived parent dies.

This is true of any subscription, connection, or session — WebSockets,
audio/video streams, IntersectionObservers, requestAnimationFrame loops,
even some animation libraries. They live or die based on where in the
tree they were mounted.

---

## The fix: lift the long-lived thing above the thing that unmounts

The voice connection needs to survive route changes, so it must be
mounted **above the router's `<Routes>`** — somewhere that doesn't
unmount when the user navigates.

```tsx
// AFTER — App.tsx
<GlobalVoiceProvider>           {/* <LiveKitRoom> lives here */}
  <GlobalVoiceDock />           {/* persistent floating control bar */}
  <Routes>
    <Route ... />               {/* routes mount/unmount under it */}
  </Routes>
</GlobalVoiceProvider>
```

`<GlobalVoiceProvider>` wraps the entire route tree in a single
`<LiveKitRoom>`. Now when you navigate from `/app/labs/voice/abc` to
`/app/calendar`, only the `Route` children swap — the `LiveKitRoom`
above them stays mounted. The peer connection persists. The mic stays
open.

That's the entire mechanical fix. The rest of the work is plumbing
state so the rest of the app can talk to a Room it doesn't directly
own.

---

## How the page talks to the hoisted Room

Now that the Room lives at the app root, individual route components
can't pass props to it directly — there's no parent-child relationship
to wire through. So we use a Zustand store as a side channel.

`src/lib/voice-session-store.ts` is the shared intent surface:

```ts
{
  channelId: string | null,   // user wants to be in this channel
  token: string | null,       // LiveKit token for that channel
  livekitUrl: string | null,  // matching LiveKit server URL
  myActivityKind: ActivityKind | null,
  hasConnected: boolean,
}
```

The flow is:

1. **User clicks Join on the voice page.** The page calls
   `store.joinChannel(channelId)` and `store.setSession({ channelId,
   token, livekitUrl })`. This is "intent" — the user wants to be in
   this channel.

2. **`GlobalVoiceProvider` reads the store.** It passes the token and
   url to `<LiveKitRoom>`, with
   `connect={Boolean(channelId && token && livekitUrl)}`.

3. **LiveKit connects.** Since `connect` flipped to `true`, the
   `Room` opens a peer connection, joins, fires `onConnected`.

4. **The user navigates anywhere.** The `Routes` swap; the
   `GlobalVoiceProvider` does not. The connection lives on.

5. **The user clicks Leave on the dock.** That button calls
   `room.disconnect()`. The room fires `onDisconnected`. The provider's
   handler calls `store.leaveChannel()`. `connect` flips to false. Done.

---

## Edge case: switching channels

The trickiest case is **A → B while connected**. Two states have to
change atomically: the LiveKit connection must move from room A to
room B, and the store must reflect channel B.

We handle this with a deliberate two-step:

1. `store.joinChannel(B)` sets `channelId = B` and **clears the
   token**. The new credentials don't exist yet.

2. `<LiveKitRoom>`'s `connect` prop becomes `false` (because token is
   null). LiveKit disconnects from A.

3. `useVoiceSessionLifecycle` notices `channelId` set with no token,
   fetches B's token, writes it back via `store.setSession`.

4. `connect` flips back to `true`. LiveKit connects to B.

The handler for `onDisconnected` knows about this gap: it sees
`channelId !== null && token === null` and treats that as "we're
mid-switch, don't clear the store." So a channel switch never
accidentally looks like an explicit leave.

`setSession` also discards stale token writes — if the user switched
A → B → C before A's token fetch resolved, A's late-arriving result
is dropped because the store's `channelId` no longer matches.

---

## Edge case: state that should survive the navigation

A few specific bits of state also needed to live in the store, not the
page:

- **`myActivityKind`** — which activity surface (notes, whiteboard,
  watch party, quiz) this user is currently viewing. Was local
  `useState` in `VoiceLabPage`. If the user opened a whiteboard,
  navigated away, then navigated back, the page would re-mount with
  no idea the user was previously in a whiteboard. Moving this into
  the store makes "I am in a whiteboard" a property of the *session*,
  not the page.

- **`hasConnected`** — gates the "you left voice" toast so we don't
  fire it on a cancelled connect attempt. Resets on `leaveChannel`.

What does NOT live in the store:

- **Mute / deafen / noise suppression.** Mute lives on
  `Room.localParticipant.isMicrophoneEnabled` — and because the Room
  itself never unmounts, mute state survives navigation automatically.
  No mirror needed. Deafen and noise suppression already live in
  `useVoiceUiState`, a separate persisted store.

- **Activity content** (whiteboard strokes, notes text, quiz answers).
  These are already realtime-backed by Socket.IO subscriptions keyed
  off `channelId`. When the user navigates back into the activity, the
  React Query cache + Socket.IO subscription replay the current state.

---

## The persistent panel

Once the user can leave the voice page while still on a call, we need
to tell them so — and give them controls to mute / leave / jump back.

Rather than a floating centered dock, the voice status sits in the
bottom-left user panel slot of the app shell on **every** authed page.
This is the slot that Discord uses too, and the user already looks
there for their avatar / settings / headphones — so adding voice
controls above it doesn't introduce new chrome, it extends an existing
surface.

The implementation:

- `GlobalUserPanel` is the component every page passes to the shell's
  `userPanel` prop. It reads `channelId` from the voice store and
  routes the panel's slots based on context:
  - **In voice, off the channel's route** → jump-to-channel button.
  - **In voice, on the channel's route** → no jump button (already
    there). Activity launcher is wired via the page's richer handler.
  - **Not in voice** → the voice section collapses to zero height,
    only the user card renders.
- `VoiceStatusRow` is the shared primitive: signal icon + "Voice
  Connected" + slug + mic-wave + (jump) + hang-up on the top row, then
  a 4-button chunky grid below (Pomodoro / Share screen / Activities /
  Soundboard).
- Activity clicks from a non-voice route navigate to the voice channel
  first and set the activity kind in the store, so the user lands
  directly on the chosen surface.

The voice page itself (`VoiceLabPage`) renders the same
`VoiceUserPanelGroup` directly (not via `GlobalUserPanel`) because it
owns the host-conflict-checking activity handler that the global
fallback doesn't have.

---

## The general pattern

Whenever you find yourself wanting "this thing should keep running
while the user navigates," ask:

1. **What component currently mounts it?** If that component is a
   route, you have the same bug as we did.

2. **How high in the tree does it need to live?** Find the first
   ancestor that doesn't unmount during the navigation you care about.
   For "survives any route" → above `<Routes>`. For "survives within
   the app shell" → inside the shell but above the route outlet.

3. **What state needs to travel with it?** Anything the page used to
   own via `useState` that the thing depends on — connection
   credentials, "what view am I in," lifecycle flags. Move that into
   a Zustand store keyed by intent, not by component lifetime.

4. **How do consumers express intent to it now that they can't
   prop-drill?** Store actions. Components call `store.joinChannel(id)`
   instead of passing props up to the parent that owns the
   connection.

5. **How does the lifted component clean up cleanly?** Its lifecycle
   callbacks (`onConnected`, `onDisconnected`, `onError`) should
   reconcile the store. The provider becomes the single point that
   translates "real connection events" into "store state" and vice
   versa.

Other features in this codebase that follow the same pattern:

- **Dynamic Island** — `DynamicIsland` is mounted in `App.tsx`
  alongside the provider. Its content is driven by `useIslandStore`.
  Same shape, different concern.

- **Pomodoro** — `usePomodoroStore` runs the timer in a store; the
  UI surfaces (island + the pomodoro page) just read from it. The
  timer survives every route change because the store outlives the
  components.

- **Toasts** — `lib/toast.ts` is an imperative store + a `<Toaster>`
  mounted once. Any component can fire `toast.success(...)` without
  caring where the surface lives.

The shared idea: **separate the long-lived thing's identity from its
visual surface.** The connection / timer / toast queue exists in a
store with app-wide lifetime; the React component that visualises it
can mount and unmount as freely as the route tree wants.

---

## Files involved in this change

- `frontend/src/lib/voice-session-store.ts` — the store
- `frontend/src/components/voice/GlobalVoiceProvider.tsx` —
  the hoisted `<LiveKitRoom>` + room-scoped side effects
- `frontend/src/components/app-shell/GlobalUserPanel.tsx` —
  the per-page wrapper every route slots into its `userPanel` prop
- `frontend/src/components/voice/VoiceStatusRow.tsx` —
  the Discord-style status card (top row + 4-button chunky grid)
- `frontend/src/hooks/useVoiceSessionLifecycle.ts` — token
  bridge between the store and React Query
- `frontend/src/hooks/useActivityHostStopSync.ts` — clears
  `myActivityKind` when the host of a host-led activity ends it
- `frontend/src/pages/app/labs/VoiceLabPage.tsx` — refactored
  from "owner of the Room" to "consumer of the store"
- `frontend/src/queries/auth.ts` — sign-out now calls
  `leaveChannel()` before clearing the auth cache
- `frontend/src/App.tsx` — wires `GlobalVoiceProvider` around
  `<Routes>` and mounts `GlobalVoiceDock`
