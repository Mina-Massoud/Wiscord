# Media caching — how avatars (and every other image) stay cached

This is a walk-through of the caching architecture for anything served by
`/storage/:id` (avatars today, attachments and chat images later). It's
written as a learning piece — the goal is for you to be able to extend the
same pattern to new media surfaces without re-deriving any of this.

---

## The problem — why a "normal `<img>`" wasn't enough

The backend stores files in Telegram (MTProto) and streams the bytes back
through `GET /storage/:id`. That endpoint is **auth-gated** by the
`wiscord_session` HttpOnly cookie. In dev, the frontend (`localhost:5173`)
talks to the backend (`localhost:3001`) — different origins.

Three pain points stack up:

1. **Cross-origin sub-resource cookies don't get sent by default.** A bare
   `<img src="http://localhost:3001/storage/abc">` does NOT include the
   session cookie. The backend returns 401 and the user sees a broken-image
   icon. Top-level navigation (paste the URL into a new tab) does send the
   cookie under `SameSite=Lax`, which is why "the link works" but "the
   image doesn't."

2. **`crossOrigin="use-credentials"` fixes the first 401, but introduces
   caching weirdness.** Browsers handle cache for credentialed cross-origin
   image responses inconsistently — even with valid `Cache-Control` and
   `ETag` headers. Chrome in particular often re-fetches.

3. **Helmet's default `Cross-Origin-Resource-Policy: same-origin`** quietly
   tells the browser the response cannot be embedded cross-origin. CORS
   credentials let it load anyway, but several browsers respond by
   declining to cache it.

So we have a stack of three browser-side defenses that, individually,
make a lot of sense — together they yield "image reloads every time the
panel opens." We can't fix that with one HTTP header.

---

## The shape of the fix — two layers, each doing one job

| Layer | Where | What it does | When it kicks in |
|---|---|---|---|
| 1. **In-memory blob cache** | Frontend (TanStack Query) | Fetches each storage id once, hands back a same-origin `blob:` URL, pins it in the query cache | Every render after the first within an SPA session |
| 2. **HTTP cache headers** | Backend (`/storage/:id`) | `ETag` + `Cache-Control: private, max-age=86400, immutable` + cheap `If-None-Match` 304 | Across full page reloads (F5), and as a fallback for code paths that don't go through Layer 1 |

Layer 1 is the primary win: zero network for re-renders within a session.
Layer 2 is the safety net so a hard refresh isn't a cliff.

---

## Layer 1 — the blob cache

### The hook (`frontend/src/queries/media.ts`)

```ts
export function useMediaBlobUrl(src: string | null | undefined): string | null {
  const id = typeof src === 'string' ? extractStorageId(src) : null;

  const query = useQuery({
    queryKey: mediaBlobKey(id ?? ''),
    queryFn: ({ signal }) => fetchMediaBlobUrl(id!, signal),
    enabled: id !== null,
    staleTime: Infinity,   // content-addressed — never stale
    gcTime: 30 * 60_000,   // hold for 30 min of inactivity then revoke
    retry: 0,
  });

  if (id === null) return src ?? null;   // pass-through for data: / public assets
  return query.data ?? null;
}
```

The interesting bits:

- **`extractStorageId(src)`** decides whether the URL is "ours." If it
  doesn't start with `${API_URL}/storage/`, we return the original URL
  unchanged — `data:` identicons and `/logo/sleepy.webp` go straight
  through, no extra fetch.
- **`staleTime: Infinity`** is honest because `/storage/:id` is
  content-addressed by Mongo `ObjectId`. The bytes for a given id can
  never change — uploading a new avatar mints a new id. So "stale" has
  no meaning for this query.
- **`gcTime: 30 min`** is the memory budget. After 30 min of nothing
  consuming the entry, TanStack Query evicts it.
- **`retry: 0`** because credentialed media failures are usually 401/404,
  neither of which retry helps.

### The blob fetch (already existed)

```ts
export async function fetchMediaBlobUrl(id: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(mediaUrl(id), {
    credentials: 'include',  // <- this is what crossOrigin="use-credentials" did for <img>
    signal,
  });
  if (!response.ok) throw new ApiError(response.status, 'media_fetch_failed', ...);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
```

`URL.createObjectURL` returns a string like
`blob:http://localhost:5173/4f1c1e7a-…`. From the browser's perspective
that's a same-origin URL pointing at bytes already in RAM. No network,
no CORS, no cookies, no cache headers — just a pointer to a Blob object.

### The cleanup wire-up (`frontend/src/queries/client.ts`)

The Blob bytes stay rooted by the URL string. If we never call
`URL.revokeObjectURL`, they leak as the session grows. TanStack Query
doesn't have an `onRemove` hook on `useQuery` directly, but the cache
exposes events:

```ts
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'removed') return;
  const [namespace] = event.query.queryKey as readonly unknown[];
  if (namespace !== 'media-blob') return;
  const data = event.query.state.data;
  if (typeof data === 'string' && data.startsWith('blob:')) {
    URL.revokeObjectURL(data);
  }
});
```

When `gcTime` elapses → entry removed → subscriber fires → blob URL
revoked → bytes reclaimable by the JS GC. The whole lifecycle is owned
inside one file — feature code never has to think about it.

### The component (`frontend/src/components/ui/media-img.tsx`)

Once the hook exists, the component becomes trivial:

```tsx
export const MediaImg = forwardRef<HTMLImageElement, MediaImgProps>(function MediaImg(
  { src, ...rest },
  ref,
) {
  const resolvedSrc = useMediaBlobUrl(typeof src === 'string' ? src : null);
  return <img ref={ref} src={resolvedSrc ?? undefined} {...rest} />;
});
```

Three things to notice:
- No `crossOrigin` prop. Blob URLs are same-origin; the browser doesn't
  do CORS for them.
- `src` is `undefined` while the first fetch is in flight. We
  intentionally don't fall through to the raw cross-origin URL during
  loading, because that would defeat the whole point — the browser
  would fetch the bytes a second time.
- No new props on `MediaImg`. It's still a drop-in for `<img>`.

---

## Layer 2 — the HTTP cache headers

The frontend cache is RAM-only. F5 nukes it. So the backend also needs to
be honest about how cacheable each response is.

### What changed in `backend/src/modules/storage/routes.ts`

```ts
storageRouter.get('/:id', requireAuth, async (req, res, next) => {
  const { id } = mediaIdParam.parse(req.params);
  const etag = `"${id}"`;                 // strong ETag — id is the content hash

  // (1) Cheap revalidation — answer 304 without touching Telegram
  if (req.header('if-none-match') === etag) {
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(304).end();
    return;
  }

  const { doc, stream } = await getMediaForViewer({ id, viewerId: req.userId! });
  // …Content-Type / Content-Length / Content-Disposition…
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // …stream the bytes…
});
```

Why each line is there:

- **`ETag: "${id}"`** — strong ETag based on the immutable id. We don't
  need a content hash because the id IS the content hash for our purposes.
- **`If-None-Match` short-circuit** — when the browser revalidates, we
  return 304 immediately. The auth check (`requireAuth`) still runs, so
  authz isn't bypassed. The big win: no Telegram MTProto round-trip on
  revalidation.
- **`Cache-Control: private, max-age=86400, immutable`**:
  - `private` — only the user's browser may cache; never a shared CDN
    (every byte is per-user-gated).
  - `max-age=86400` — one day of guaranteed cache-without-revalidation.
  - `immutable` — modern browsers won't even revalidate within the
    window. Honest because the id ↔ bytes binding never changes.
- **`Cross-Origin-Resource-Policy: cross-origin`** — overrides helmet's
  default `same-origin` per-route. Without this, browsers may decline to
  cache the response even when CORS allows the load.

---

## How the two layers interact

| User action | Layer 1 (blob cache) | Layer 2 (HTTP cache) | Network round-trips |
|---|---|---|---|
| First view of an avatar | miss → `fetch()` | miss → full stream from Telegram | 1 full download |
| Re-open the same panel in the same session | hit → returns blob URL | not consulted | **0** |
| Switch route, come back | hit → returns blob URL | not consulted | **0** |
| F5 (full reload), open panel | miss (RAM gone) | hit (`If-None-Match` → 304) | 1 round-trip, no body |
| F5 + 2 days later | miss | miss (max-age expired, revalidates with ETag → 304 still works) | 1 round-trip, no body |
| Avatar replaced via upload | new id → new query key → miss → fetch | new id → new URL → miss → fetch | 1 full download for the new id |

The third row is the one that motivated all this: **0 network requests
when bouncing between routes.**

---

## Why a TanStack Query cache and not a plain `Map`?

I considered a global `Map<string, string>` keyed by id, with a refcount
for cleanup. It works, but TanStack Query gives you:

- **In-flight dedupe.** 50 `<MediaImg>` for the same id mounting at once
  → one network request, all share the result.
- **Subscription model.** Components re-render exactly when data is ready;
  no manual `useState` + `useEffect` per consumer.
- **Built-in lifecycle.** `gcTime` evicts unused entries automatically.
- **DevTools.** You can inspect every cached blob URL in the Query
  DevTools panel.

The trade-off is one extra dependency on TanStack Query semantics — but
the project is already query-first, so it's a free win.

---

## Things to watch out for when extending this

### 1. Don't fall back to the raw URL while loading

Tempting to write:

```tsx
return <img src={resolvedSrc ?? src} ... />;   // ❌ bad
```

This would let the browser fetch the cross-origin URL during the brief
loading window, kicking off a parallel network request that defeats the
whole cache. The current `src={resolvedSrc ?? undefined}` is intentional.

If a momentarily-empty `<img>` annoys you, render an explicit placeholder
(skeleton, identicon) — don't fall back to the storage URL.

### 2. The blob is per-tab, not per-document-origin

`URL.createObjectURL` is scoped to the document that called it. If you
spawn an iframe or popup, that window can't use the parent's blob URL.
For Wiscord today this is fine — everything renders in the main window.

### 3. Long-lived sessions and memory

`gcTime: 30 min` means an avatar viewed once and never again sticks in
RAM for 30 min. For a typical study session with ~50 unique avatars at
~5 KB each, that's ~250 KB. Fine. If you expand to chat attachments
(possibly large images), revisit this — you may want a smaller `gcTime`
for `kind: 'image'` and longer for `kind: 'avatar'`.

### 4. Content addressing is load-bearing

The reason `staleTime: Infinity` and `Cache-Control: immutable` are both
honest is that **id → bytes is a one-way mapping**. If we ever introduce
a route that mutates bytes for an existing id (please don't), both layers
break silently. The right escape hatch if you really must: rotate to a
new id and update every reference.

### 5. Revoking too eagerly

Don't revoke a blob URL while an `<img>` is still using it — the image
will display a broken icon mid-render. The TanStack Query cache subscriber
only fires on `gcTime` elapsing, which only happens when zero components
are observing the query. Safe by construction.

---

## Where this pattern goes next

- **Chat attachments** — images, GIFs, videos that flow through
  `/storage/:id`. `<MediaImg>` already works. For `<video>`, build a
  `<MediaVideo>` with the same `useMediaBlobUrl` underneath.
- **Whiteboard assets** — `WhiteboardCanvas.tsx` already uses
  `fetchMediaBlobUrl` directly via the tldraw asset store. That's its own
  cache layer because tldraw owns the asset store interface; the same
  caching principle, different mechanism.
- **AI-generated images later** — same pattern; if an asset is content-
  addressed and immutable, it qualifies for the immutable + blob-cache
  treatment.

---

## TL;DR if you only remember three things

1. **Browser HTTP cache for credentialed cross-origin `<img>` is unreliable.**
   Don't trust it as your primary caching layer.
2. **Convert auth-gated media URLs to same-origin `blob:` URLs and cache
   those in JS memory.** Use TanStack Query so dedupe + lifecycle come for
   free. Revoke on eviction.
3. **Backend HTTP cache headers are still worth setting** — they cover
   the F5 case and any consumer that bypasses `<MediaImg>`. `immutable`
   + `ETag` + cheap 304 short-circuit so revalidation never touches the
   slow underlying storage.
