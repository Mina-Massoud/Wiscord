# Chat Feature Implementation Plan (Labs Scope)

Implement the full chat surface for Wiscord as an isolated feature in the `labs` playground route: send/receive messages with realtime fan-out, paginated history, edit/delete (soft delete), markdown rendering, @mentions, typing indicators, and emoji reactions.

## User Review Required

> [!IMPORTANT]
> **Server/Channel infrastructure is deferred.** The backend will not build `Server`, `Channel`, `ServerMember`, or `Invite` models in this phase. The chat feature will operate on arbitrary `channelId` parameters provided by the route (e.g., `/app/labs/voice/:channelId`). Security checks (like verifying a user is a member of the server) are omitted for this labs release.

## Open Questions

> [!IMPORTANT]
> 1. **Reactions** — Store as a sub-document array on Message (simpler, good for <100 reactions per message) or as a separate `Reaction` model (more scalable)? I'll default to **sub-document** since study groups are small.
> 2. **Mentions** — Store mentioned user IDs in a `mentions: [ObjectId]` array on the Message for notification queries, plus parse `@username` at render time? Or store structured mention objects? I'll default to **ID array + render-time parsing**.
> 3. **Message content limit** — Legacy schema uses 1–4000 chars. Keep that? I'll default to **yes**.

---

## Proposed Changes

### Phase 1 — Backend Models

#### [NEW] [Message.ts](file:///G:/iti/react/wiscord/backend/src/db/models/Message.ts)

```ts
// Fields:
//   channelId (string, required) - Using a simple string since Channel collection doesn't exist yet
//   authorId (ObjectId → User, required)
//   content (string, 1-4000 chars)
//   editedAt (Date | null)
//   deletedAt (Date | null)  — soft delete
//   mentions (ObjectId[] → User)  — parsed @user IDs for notification queries
//   reactions ([{ emoji: string, userIds: [ObjectId] }])  — sub-document array
// Indexes:
//   { channelId: 1, createdAt: -1 }  — message history pagination
//   { channelId: 1, mentions: 1 }    — mention queries
//   { authorId: 1 }                  — user's messages
// timestamps: true, collection: 'messages'
```

#### [MODIFY] [index.ts](file:///G:/iti/react/wiscord/backend/src/db/models/index.ts)
Add re-export for `Message`.

---

### Phase 2 — Backend Messages Module (Chat Core)

#### [NEW] [schemas.ts](file:///G:/iti/react/wiscord/backend/src/modules/messages/schemas.ts)
- `sendMessageBody` — `{ content: z.string().min(1).max(4000) }`
- `updateMessageBody` — `{ content: z.string().min(1).max(4000) }`
- `messagesQuery` — `{ before?: z.string() (cursor), limit?: z.number().min(1).max(100).default(50) }`

#### [NEW] [service.ts](file:///G:/iti/react/wiscord/backend/src/modules/messages/service.ts)
- `sendMessage(channelId, authorId, content)`:
  1. (No membership verification in labs scope).
  2. Parse `@username` mentions → resolve to user IDs → store in `mentions[]`.
  3. Create `Message` document.
  4. Populate author data (username, displayName, avatarUrl).
  5. Emit `message:created` via the realtime bridge (EventEmitter).
  6. Return populated message.
- `getMessages(channelId, { before, limit })`:
  1. Query `Message.find({ channelId, deletedAt: null })`, cursor-based pagination using `createdAt < before`, sorted `createdAt DESC`, limit.
  2. Populate author data.
  3. Return `{ messages, hasMore }`.
- `updateMessage(messageId, userId, content)`:
  1. Find message, verify `authorId === userId`.
  2. Update `content` + set `editedAt = new Date()`.
  3. Emit `message:updated` via realtime bridge.
- `deleteMessage(messageId, userId)`:
  1. Find message, verify `authorId === userId`.
  2. Set `deletedAt = new Date()` (soft delete).
  3. Emit `message:deleted` via realtime bridge.
- `addReaction(messageId, userId, emoji)` & `removeReaction(messageId, userId, emoji)`

#### [NEW] [routes.ts](file:///G:/iti/react/wiscord/backend/src/modules/messages/routes.ts)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/channels/:channelId/messages` | `requireAuth` | Send message |
| `GET` | `/channels/:channelId/messages` | `requireAuth` | Get message history (paginated) |
| `PATCH` | `/messages/:messageId` | `requireAuth` | Edit own message |
| `DELETE` | `/messages/:messageId` | `requireAuth` | Soft-delete message |
| `POST` | `/messages/:messageId/reactions` | `requireAuth` | Add reaction |
| `DELETE` | `/messages/:messageId/reactions/:emoji` | `requireAuth` | Remove reaction |

#### [NEW] [realtime-bridge.ts](file:///G:/iti/react/wiscord/backend/src/modules/messages/realtime-bridge.ts)
EventEmitter singleton (`messageEvents`) to pass events from service to socket gateway.

#### [MODIFY] [app.ts](file:///G:/iti/react/wiscord/backend/src/app.ts)
Mount `messagesRouter` under `/channels`.

---

### Phase 3 — Backend Realtime Gateway Updates

#### [MODIFY] [gateway.ts](file:///G:/iti/react/wiscord/backend/src/modules/realtime/gateway.ts)
**New client events:**
- `channel:join` — join `channel:<channelId>` room. Track "active channel" per socket.
- `channel:leave` — leave channel room.
- `typing:start` — broadcast `typing:update` to `channel:<channelId>`.
- `typing:stop` — broadcast `typing:update` to `channel:<channelId>`.

**New server-to-client event bridges:**
Wire `messageEvents` to `io.to('channel:<channelId>').emit(...)`.

---

### Phase 4 — Frontend Queries & Hooks

#### [NEW] [messages.ts](file:///G:/iti/react/wiscord/frontend/src/queries/messages.ts)
- `useChannelMessages(channelId)` — `useInfiniteQuery(qk.messages.byChannel(channelId))`.
- `useSendMessage()` — `useMutation` with optimistic update.
- `useEditMessage()` — `useMutation` with optimistic update.
- `useDeleteMessage()` — `useMutation` with optimistic update.
- `useAddReaction()` / `useRemoveReaction()` — `useMutation` with optimistic cache update.

#### [MODIFY] [client.ts](file:///G:/iti/react/wiscord/frontend/src/queries/client.ts)
Add `message:created`, `message:updated`, `message:deleted`, `message:reaction_added`, `message:reaction_removed`, `typing:update` to `ServerToClientEvents`. Add `channel:join/leave` and `typing:start/stop` to `ClientToServerEvents`.

#### [NEW] [useChannelSocket.ts](file:///G:/iti/react/wiscord/frontend/src/hooks/useChannelSocket.ts)
Subscribe to channel-scoped Socket.IO events and feed them into React Query cache.

#### [NEW] [useTypingIndicator.ts](file:///G:/iti/react/wiscord/frontend/src/hooks/useTypingIndicator.ts)
Tracks who's typing in the current channel via `typing:update` events.

---

### Phase 5 — Frontend UI Components

#### [NEW] [ChatPane.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/ChatPane.tsx)
The main chat surface. Composes `ChatMessageList` + `ChatComposer` + `TypingIndicator`. Receives `channelId` from props or context.

#### [NEW] [ChatMessageList.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/ChatMessageList.tsx)
Consumes `useChannelMessages(channelId)`. Uses reverse infinite scroll.

#### [NEW] [ChatMessage.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/ChatMessage.tsx) & [ChatMessageMarkdown.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/ChatMessageMarkdown.tsx)
Renders a single message bubble with markdown support, mentions, and reactions.

#### [NEW] [ChatComposer.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/ChatComposer.tsx)
Message input textarea with auto-resize. Typing indicator emission.

#### [NEW] [ChatReactions.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/ChatReactions.tsx) & [EmojiPicker.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/EmojiPicker.tsx)
Reaction display and lightweight emoji picker.

#### [NEW] [TypingIndicator.tsx](file:///G:/iti/react/wiscord/frontend/src/components/chat/TypingIndicator.tsx)
Animated typing indicator (e.g., "Alice is typing…").

#### [MODIFY] [VoiceLabPage.tsx](file:///G:/iti/react/wiscord/frontend/src/pages/app/labs/VoiceLabPage.tsx)
Update the VoiceLabPage layout to include the `ChatPane`. Since it's a playground route, we can place the chat UI alongside the voice UI, passing the `channelId` parameter to `ChatPane`.

---

### Phase 6 — Types

#### [NEW] [message.ts](file:///G:/iti/react/wiscord/frontend/src/types/message.ts)
```ts
interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  content: string;
  mentions: string[];
  reactions: { emoji: string; userIds: string[]; count: number }[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TypingEvent { channelId: string; userId: string; username: string; isTyping: boolean; }
interface ReactionEvent { channelId: string; messageId: string; emoji: string; userId: string; }
```

---

## Verification Plan

### Automated Tests
- Message: send, paginate, edit, delete.
- Reaction: add, remove.
- Realtime: socket joins, message fanout.
- Frontend: query hooks, markdown rendering, chat composer enter/shift+enter behavior.

### Manual Verification
1. Navigate to `/app/labs/voice/1234-5678` in two tabs.
2. Send a message in tab 1 → verify it appears in tab 2.
3. Edit a message → verify "(edited)" badge updates in tab 2.
4. Add a reaction → verify count increments in tab 2.
5. Type in the composer → verify tab 2 shows typing indicator.
6. Scroll up in a busy channel → verify pagination loads older messages.
