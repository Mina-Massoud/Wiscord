import { QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import type { QuizAnalyticsSnapshot } from '@/types/quiz';

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
  participants: Array<{ identity: string; name: string; joinedAt: number }>;
}

export interface ServerToClientEvents {
  'voice:state_changed': (change: VoiceStateChange) => void;
  'quiz:analytics_changed': (snapshot: QuizAnalyticsSnapshot) => void;
}

export interface ClientToServerEvents {
  'quiz:subscribe_host': (quizId: string, ack: (ok: boolean) => void) => void;
  'quiz:unsubscribe_host': (quizId: string) => void;
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
