import { QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import type { QuizAnalyticsSnapshot } from '@/types/quiz';
import type {
  ListenTogetherInviteResolvedEvent,
  ListenTogetherInviteSentEvent,
  ListenTogetherPlaybackEvent,
  ListenTogetherSessionEndedEvent,
} from '@/types/listen-together';
import type { EventWithMeta } from '@/types/event';
import type { MessageDto, ReactionEvent, TypingEvent } from '@/types/message';
import type { DmRoomDto } from '@/queries/dms';
import type { NotificationDto } from '@/queries/notifications';

const apiUrl = import.meta.env['VITE_API_URL'] as string | undefined;

if (!apiUrl || apiUrl.trim() === '') {
  throw new Error(
    '[wiscord] Missing VITE_API_URL. Add it to frontend/.env and restart the dev server.',
  );
}

export const API_URL = apiUrl.replace(/\/$/, '');

// ── API response envelope ───────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { total: number; page: number; limit: number };
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Thrown by the fetch wrapper when the API returns `success: false`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  search?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/**
 * Single typed fetch wrapper. Every request:
 *  - sends credentials so the session cookie travels both ways
 *  - JSON-encodes the body
 *  - unwraps the `{ success, data, error }` envelope
 *  - throws `ApiError` with the backend's error code on failure
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  if (opts.search) {
    for (const [k, v] of Object.entries(opts.search)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    throw new ApiError(0, 'network', 'Network error. Check your connection.', err);
  }

  let parsed: ApiResponse<T>;
  try {
    parsed = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(response.status, 'invalid_response', 'Server returned an invalid response.');
  }

  if (!parsed.success) {
    throw new ApiError(
      response.status,
      parsed.error.code,
      parsed.error.message,
      parsed.error.details,
    );
  }

  return parsed.data;
}

// ── Socket.IO realtime client (singleton) ──────────────────────────────────
//
// One persistent WebSocket per signed-in tab — this is the channel for every
// realtime stream Wiscord adds (voice presence, message fanout, typing,
// focus-session events). Feature files subscribe via tiny wrapper hooks; they
// must never call `io()` themselves.
//
// Lazy-instantiated so cookieless visitors (sign-in, marketing routes) don't
// open a connection until the session lands. We dial the same origin as the
// REST API and let the browser carry the `wiscord_session` cookie via
// `withCredentials`. The custom `/realtime` path keeps the socket from
// colliding with any future SSE / Vite HMR endpoints.

export interface VoiceStateChange {
  channelId: string;
  participants: Array<{
    identity: string;
    name: string;
    joinedAt: number;
    activityKind: ActivityKind | null;
  }>;
}

export interface CalendarEventChanged {
  kind: 'created' | 'updated' | 'deleted';
  channelId: string | null;
  eventId: string;
}

export interface ServerUnreadChanged {
  serverId: string;
  channelId: string;
}

export type WatchSourceKind = 'youtube' | 'direct' | 'screen';
export type WatchPartyState = 'idle' | 'playing' | 'paused';

/**
 * The six activity kinds a voice channel can be running. Watch kinds
 * (`youtube`, `screen-share`) carry source + playhead fields; lab kinds
 * (`notes`, `whiteboard`, `quiz`) ride on their own realtime channel and
 * the activity snapshot is mainly a "this channel is doing X" signal.
 * `pomodoro` is a server-anchored shared timer — see `pomodoro` on the
 * snapshot for the per-phase fields.
 */
export type ActivityKind =
  | 'youtube'
  | 'screen-share'
  | 'notes'
  | 'whiteboard'
  | 'quiz'
  | 'pomodoro';

export type PomodoroPhase = 'focus' | 'break';

export interface PomodoroSnapshot {
  phase: PomodoroPhase;
  round: number;
  totalRounds: number;
  /** ISO 8601 — server-anchored end time of the current phase. null while
   *  paused. Clients compute remaining-ms locally from this. */
  endsAt: string | null;
  /** Remaining ms snapshotted at pause. null while running. */
  pausedRemainingMs: number | null;
  /** Pending reset request from a non-host participant. Auto-expires
   *  server-side after 30s. */
  resetRequest: {
    byUserId: string;
    requestedAt: string;
  } | null;
}

export interface VoiceActivitySnapshot {
  channelId: string;
  kind: ActivityKind;
  hostUserId: string;
  startedAt: string;
  /** Watch-only — null for non-watch kinds. */
  source: {
    kind: WatchSourceKind;
    url: string;
    title: string | null;
  } | null;
  /** Watch-only. */
  state: WatchPartyState | null;
  currentTimeMs: number;
  /** ISO 8601 timestamp — wall clock the playhead is anchored to. Watch-only. */
  lastTickAt: string | null;
  /** Quiz-only — the host-pinned quiz to broadcast, or null. */
  quizId: string | null;
  /** Pomodoro-only — phase/round/endsAt/etc. null for non-pomodoro kinds. */
  pomodoro: PomodoroSnapshot | null;
}

export interface VoiceActivityChange {
  channelId: string;
  /** null on a stop event — viewers should exit the activity. */
  snapshot: VoiceActivitySnapshot | null;
}

/**
 * Narrowed view of a `VoiceActivitySnapshot` when the kind is a watch kind.
 * Watch-only components (`WatchPlayer`, `useWatchSync`) accept this so they
 * don't have to defend against nullable watch fields at every read site.
 */
export interface WatchActivitySnapshot {
  channelId: string;
  kind: 'youtube' | 'screen-share';
  hostUserId: string;
  startedAt: string;
  source: {
    kind: WatchSourceKind;
    url: string;
    title: string | null;
  };
  state: WatchPartyState;
  currentTimeMs: number;
  lastTickAt: string;
}

/**
 * Narrow a `VoiceActivitySnapshot` to its watch-only projection, or return
 * null if the activity isn't a watch kind / is missing required fields.
 */
export function asWatchActivity(activity: VoiceActivitySnapshot): WatchActivitySnapshot | null {
  if (activity.kind !== 'youtube' && activity.kind !== 'screen-share') return null;
  if (!activity.source || !activity.state || !activity.lastTickAt) return null;
  return {
    channelId: activity.channelId,
    kind: activity.kind,
    hostUserId: activity.hostUserId,
    startedAt: activity.startedAt,
    source: activity.source,
    state: activity.state,
    currentTimeMs: activity.currentTimeMs,
    lastTickAt: activity.lastTickAt,
  };
}

export interface FriendUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendRequestDto {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  respondedAt: string | null;
  user: FriendUserDto;
  outgoing: boolean;
}

export interface FriendDto {
  user: FriendUserDto;
  friendedAt: string;
}

export interface FriendRequestIncomingEvent {
  toUserId: string;
  request: FriendRequestDto;
}
export interface FriendRequestRespondedEvent {
  toUserId: string;
  requestId: string;
  newFriend: FriendDto | null;
}
export interface FriendRemovedEvent {
  toUserId: string;
  removedUserId: string;
}

export interface ServerToClientEvents {
  'voice:state_changed': (change: VoiceStateChange) => void;
  'quiz:analytics_changed': (snapshot: QuizAnalyticsSnapshot) => void;
  'calendar:event_changed': (change: CalendarEventChanged) => void;
  'voice:activity_changed': (change: VoiceActivityChange) => void;
  'friend_request:incoming': (event: FriendRequestIncomingEvent) => void;
  'friend_request:accepted': (event: FriendRequestRespondedEvent) => void;
  'friend_request:declined': (event: FriendRequestRespondedEvent) => void;
  'friend_request:cancelled': (event: FriendRequestRespondedEvent) => void;
  'friend:removed': (event: FriendRemovedEvent) => void;
  'listen_together:invite_received': (event: ListenTogetherInviteSentEvent) => void;
  'listen_together:invite_resolved': (event: ListenTogetherInviteResolvedEvent) => void;
  'listen_together:session_ended': (event: ListenTogetherSessionEndedEvent) => void;
  'listen_together:playback': (event: ListenTogetherPlaybackEvent) => void;
  'server_event:created': (event: { serverId: string; event: EventWithMeta }) => void;
  'server_event:updated': (event: {
    serverId: string;
    eventId: string;
    event: EventWithMeta;
  }) => void;
  'server_event:deleted': (event: { serverId: string; eventId: string }) => void;
  'server_event:rsvp_changed': (event: {
    serverId: string;
    eventId: string;
    goingCount: number;
    interestedCount: number;
  }) => void;
  'server_unread:changed': (event: ServerUnreadChanged) => void;

  // Chat
  'dm_room:updated': (room: DmRoomDto) => void;
  'notification:created': (notification: NotificationDto) => void;
  'notification:updated': (notification: NotificationDto) => void;
  'notification:deleted': (data: { notificationId: string }) => void;
  'notification:read-cleared': (data: { toUserId: string }) => void;
  'message:created': (message: MessageDto) => void;
  'message:updated': (message: MessageDto) => void;
  'message:deleted': (data: { messageId: string }) => void;
  'message:reaction_added': (data: ReactionEvent) => void;
  'message:reaction_removed': (data: ReactionEvent) => void;
  'typing:update': (data: TypingEvent) => void;
}

export interface ClientToServerEvents {
  'quiz:subscribe_host': (quizId: string, ack: (ok: boolean) => void) => void;
  'quiz:unsubscribe_host': (quizId: string) => void;
  'calendar:subscribe_channel': (channelId: string, ack: (ok: boolean) => void) => void;
  'calendar:unsubscribe_channel': (channelId: string) => void;
  'voice:subscribe_activity': (channelId: string, ack: (ok: boolean) => void) => void;
  'voice:unsubscribe_activity': (channelId: string) => void;
  'server_events:subscribe': (serverId: string, ack: (ok: boolean) => void) => void;
  'server_events:unsubscribe': (serverId: string) => void;

  // Chat
  'channel:join': (channelId: string) => void;
  'channel:leave': (channelId: string) => void;
  'typing:start': (channelId: string, username: string) => void;
  'typing:stop': (channelId: string, username: string) => void;
}

export type WiscordSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: WiscordSocket | null = null;

export function getSocket(): WiscordSocket {
  if (socket) return socket;
  socket = io(API_URL, {
    path: '/realtime',
    withCredentials: true,
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

// ── TanStack QueryClient ────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, err) => {
        // Don't retry auth failures — they won't fix themselves.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return false;
        return failureCount < 1;
      },
    },
  },
});

// `useMediaBlobUrl` (queries/media.ts) caches `blob:` URLs for backend storage
// assets. The Blob bytes stay rooted by the URL string until we explicitly
// `URL.revokeObjectURL` them — without this subscriber they'd leak as the
// session grew. When TanStack Query evicts a `['media-blob', id]` entry past
// its `gcTime`, revoke the URL so the underlying Blob can be reclaimed.
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'removed') return;
  const [namespace] = event.query.queryKey as readonly unknown[];
  if (namespace !== 'media-blob') return;
  const data = event.query.state.data;
  if (typeof data === 'string' && data.startsWith('blob:')) {
    URL.revokeObjectURL(data);
  }
});
