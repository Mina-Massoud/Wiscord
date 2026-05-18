import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAiCapsuleStore } from '@/components/ai/useAiCapsuleStore';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';
import { api, API_URL } from './client.js';
import { qk } from './keys.js';

/**
 * SSE consumer for `POST /ai/ask`. The backend writes
 * `data: {type, ...}\n\n` events; we parse them line-by-line and
 * surface them through the `useAskAi` hook as React state.
 *
 * Three end-states per CLAUDE.md's three-states rule:
 *   - idle       — nothing in flight, no answer yet
 *   - streaming  — at least one token received, response is growing
 *   - error      — non-2xx, network failure, or `{type:"error"}` event
 *
 * Aborts inflight requests on unmount or on a fresh `ask()` call so a
 * navigation away doesn't strand the connection.
 */

export type AiScope = 'personal' | 'channel' | 'server' | 'voice';

export interface AiSource {
  /** Form: 'note:<channelId>' | 'event:<id>' | 'attempt:<id>' | 'activity:<channelId>' | 'quiz:<quizId>' */
  id: string;
  kind: 'note' | 'event' | 'attempt' | 'activity' | 'quiz';
  label: string;
  /** Set only on event sources — ISO datetime so the inline
   *  calendar pane can open scoped to the cited day. */
  startAt?: string;
  /** Set only on quiz sources — channelId the quiz belongs to. The
   *  workshop deep link is `/app/labs/quiz/<channelId>?quiz=<quizId>`. */
  channelId?: string;
}

export interface AiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

export type AiStatus = 'idle' | 'streaming' | 'done' | 'error';

/**
 * One message in the persisted conversation. Mirrors the shape
 * the backend stores in the AiConversation model. `pending`
 * marks the in-flight assistant turn — tokens append to its
 * `text` as the SSE stream emits them.
 */
export type AiToolName =
  | 'createCalendarEvent'
  | 'updateCalendarEvent'
  | 'deleteCalendarEvent'
  | 'createNote'
  | 'generateExam';

export interface AiToolCall {
  callId: string;
  name: AiToolName;
  args: Record<string, unknown>;
  needsConfirmation: boolean;
  /** Populated once `tool_result` arrives or the user confirms. */
  result: Record<string, unknown> | null;
  error: string | null;
  /** True once the tool has run (success, fail, or user-declined). */
  resolved: boolean;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  text: string;
  sources: AiSource[];
  toolCalls: AiToolCall[];
  createdAt: string;
  /** True while the assistant turn is still streaming. */
  pending?: boolean;
}

export interface AskAiState {
  status: AiStatus;
  messages: AiMessage[];
  /** True while the GET /ai/conversation request is in flight. */
  isLoading: boolean;
  usage: AiUsage | null;
  error: string | null;
  ask: (question: string, scope?: AiScope, scopeId?: string) => Promise<void>;
  /** Wipes the conversation server-side and locally. */
  clear: () => Promise<void>;
}

interface ConversationResponse {
  scope: AiScope;
  scopeId: string | null;
  messages: Array<{
    role: 'user' | 'assistant';
    text: string;
    sources: Array<{
      kind: 'note' | 'event' | 'attempt' | 'activity' | 'quiz';
      id: string;
      title: string;
      startAt?: string;
      channelId?: string;
    }>;
    toolCalls: Array<{
      callId: string;
      name: AiToolName;
      args: Record<string, unknown>;
      status: 'pending_confirmation' | 'executed' | 'failed' | 'declined';
      result?: Record<string, unknown> | null;
      error?: string | null;
    }>;
    createdAt: string;
  }>;
}

const CONVERSATION_KEY = ['ai', 'conversation', 'personal'] as const;

interface NotePlaintextResponse {
  channelId: string;
  plaintext: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Fetches a note's plaintext for the AI capsule's inline source
 * pane. 60s stale-time — the pane is read-only and the user
 * doesn't expect realtime updates here ("Open in editor" routes
 * to the live TipTap surface).
 */
export function useNotePlaintext(channelId: string | null) {
  return useQuery({
    queryKey: ['ai', 'sources', 'note', channelId] as const,
    queryFn: () => api<NotePlaintextResponse>(`/ai/sources/note/${channelId}`),
    enabled: channelId !== null && channelId.length > 0,
    staleTime: 60_000,
  });
}

function toAiMessages(response: ConversationResponse): AiMessage[] {
  return response.messages.map((m) => ({
    role: m.role,
    text: m.text,
    sources: m.sources.map((s) => ({
      id: `${s.kind}:${s.id}`,
      kind: s.kind,
      label: s.title,
      startAt: s.startAt,
      channelId: s.channelId,
    })),
    toolCalls: (m.toolCalls ?? []).map((t) => ({
      callId: t.callId,
      name: t.name,
      args: t.args,
      // Persisted entries carry status; we map it back to the
      // live-call shape used during the stream so the UI doesn't
      // need two render paths.
      needsConfirmation: t.status === 'pending_confirmation',
      result: t.result ?? null,
      error: t.error ?? null,
      resolved: t.status !== 'pending_confirmation',
    })),
    createdAt: m.createdAt,
  }));
}

interface RawSources {
  notes?: Array<{ channelId: string; title: string; updatedAt: string }>;
  events?: Array<{ id: string; title: string; startAt: string }>;
  attempts?: Array<{ id: string; title: string; score: number; submittedAt: string | null }>;
  activities?: Array<{ channelId: string; kind: string; title: string; startedAt: string }>;
}

function flattenSources(raw: RawSources): AiSource[] {
  const out: AiSource[] = [];
  for (const n of raw.notes ?? []) {
    out.push({ id: `note:${n.channelId}`, kind: 'note', label: n.title });
  }
  for (const e of raw.events ?? []) {
    out.push({ id: `event:${e.id}`, kind: 'event', label: e.title, startAt: e.startAt });
  }
  for (const a of raw.attempts ?? []) {
    out.push({ id: `attempt:${a.id}`, kind: 'attempt', label: a.title });
  }
  for (const v of raw.activities ?? []) {
    out.push({ id: `activity:${v.channelId}`, kind: 'activity', label: v.title });
  }
  return out;
}

/**
 * Regex that matches every `[kind:id]` citation the AI emits.
 * Used to filter the full retrieved-sources list down to *only*
 * those the AI actually cited in its reply — so chips don't
 * show 8 notes + 20 events that never made it into the answer.
 *
 * Lenient on the id half (`[\w-]+`) so unusual ids (Mongo
 * ObjectIds, UUIDs, slugified strings) all match.
 */
const CITATION_RE = /\[(note|event|attempt|activity|quiz):([\w-]+)\]/g;

/**
 * Return the subset of `sources` whose `id` actually appears in
 * `responseText`. If no citations are present yet (mid-stream,
 * before the model has emitted any bracket), returns an empty
 * array — the UI shows nothing rather than spamming every
 * retrieved row.
 */
export function filterCitedSources(sources: AiSource[], responseText: string): AiSource[] {
  const cited = new Set<string>();
  for (const match of responseText.matchAll(CITATION_RE)) {
    cited.add(`${match[1]}:${match[2]}`);
  }
  if (cited.size === 0) return [];
  return sources.filter((s) => cited.has(s.id));
}

/**
 * Segmented split of an assistant text by citation markers.
 * Returns an interleaved array of plain-text segments and
 * citation references so the renderer can swap each `[kind:id]`
 * for an interactive badge inline.
 *
 * Unknown ids (regex matched but not present in `sources`) are
 * skipped and re-rendered as the original bracket text — better
 * to show the raw form than drop characters silently.
 */
export type TextSegment = { kind: 'text'; value: string } | { kind: 'citation'; source: AiSource };

export function segmentAssistantText(text: string, sources: AiSource[]): TextSegment[] {
  if (text.length === 0) return [];
  const byId = new Map(sources.map((s) => [s.id, s]));
  const segments: TextSegment[] = [];
  let cursor = 0;

  // `matchAll` returns each match with `.index` so we can slice
  // the surrounding plain text and walk left-to-right.
  for (const match of text.matchAll(CITATION_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, start) });
    }
    const id = `${match[1]}:${match[2]}`;
    const source = byId.get(id);
    if (source) {
      segments.push({ kind: 'citation', source });
    } else {
      // Unknown id — keep the raw marker so the reader still sees
      // something rather than a phantom-deleted phrase.
      segments.push({ kind: 'text', value: match[0] });
    }
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }
  return segments;
}

/**
 * Find the end of the next SSE event in `buf`. Events are separated
 * by a blank line. Accept LF/LF, CRLF/CRLF, and mixed boundaries.
 * Returns `{ end, next }` where `end` is the slice index up to (but
 * excluding) the blank-line terminator and `next` is the resume
 * position to slice `buf` from. Returns -1 when no complete event
 * is buffered yet.
 */
function findEventBoundary(buf: string): { end: number; next: number } | -1 {
  const candidates = [
    { needle: '\r\n\r\n', len: 4 },
    { needle: '\n\n', len: 2 },
    { needle: '\r\r', len: 2 },
  ];
  let best = -1;
  let bestLen = 0;
  for (const c of candidates) {
    const idx = buf.indexOf(c.needle);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
      bestLen = c.len;
    }
  }
  if (best === -1) return -1;
  return { end: best, next: best + bestLen };
}

type WireEvent =
  | { type: 'sources'; sources: RawSources }
  | { type: 'token'; text: string }
  | {
      type: 'tool_call';
      callId: string;
      name: AiToolName;
      args: Record<string, unknown>;
      needsConfirmation: boolean;
    }
  | {
      type: 'tool_result';
      callId: string;
      result: Record<string, unknown> | null;
      error: string | null;
    }
  | { type: 'done'; usage: AiUsage }
  | { type: 'error'; code: string; message: string };

/**
 * Confirm or decline a destructive tool call queued during a
 * stream. Pending entries are single-use server-side.
 */
export async function confirmTool(
  callId: string,
  action: 'confirm' | 'decline',
): Promise<{ callId: string; result?: Record<string, unknown>; declined?: boolean }> {
  return api<{ callId: string; result?: Record<string, unknown>; declined?: boolean }>(
    `/ai/tools/confirm/${callId}`,
    { method: 'POST', body: { action } },
  );
}

/**
 * Hook entry point. Conversation is backed by TanStack Query so
 * collapse/expand of the capsule preserves history (the data lives
 * in the query cache, the AiCapsule mounts/unmounts at will).
 *
 * `ask()` optimistically appends both the user turn AND a pending
 * assistant turn, then opens the SSE stream that appends tokens to
 * the pending turn's text in place.
 */
export function useAskAi(): AskAiState {
  const queryClient = useQueryClient();
  const openSourcePane = useAiCapsuleStore((s) => s.openSourcePane);

  const conversation = useQuery({
    queryKey: CONVERSATION_KEY,
    queryFn: () => api<ConversationResponse>('/ai/conversation'),
    staleTime: 30_000,
  });

  // Streaming overlay state — tokens land here while the SSE is
  // open, then get flushed into the query cache on `done`. This
  // keeps the cache from re-rendering the entire message list on
  // every token (1 paint per chunk would melt long histories).
  const [streamingText, setStreamingText] = useState('');
  const [streamingSources, setStreamingSources] = useState<AiSource[]>([]);
  const [streamingToolCalls, setStreamingToolCalls] = useState<AiToolCall[]>([]);
  const [status, setStatus] = useState<AiStatus>('idle');
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Tracks the createdAt stamp for the in-flight optimistic turn so the
  // `messages` array doesn't churn keys every render (new Date() per
  // render would cause AnimatePresence to remount bubbles on each token).
  const optimisticStartRef = useRef<string | null>(null);

  // Abort any in-flight SSE on unmount so a navigation away doesn't
  // strand the connection or leave callbacks racing setState into an
  // unmounted tree.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const persistedMessages = useMemo<AiMessage[]>(
    () => (conversation.data ? toAiMessages(conversation.data) : []),
    [conversation.data],
  );

  // Keep the optimistic overlay visible across the `done` → refetch
  // window. Without the `done` branch the assistant bubble vanishes
  // for the 200-600ms invalidation gap and then reappears once
  // persisted data arrives — visibly flickering. Holding it through
  // `done` keeps the message on screen until the .finally() clears
  // `pendingUserText` (after the refetch settles).
  const showStreamingOverlay = status === 'streaming' || status === 'done';
  const messages: AiMessage[] = useMemo(() => {
    const stamp = optimisticStartRef.current ?? new Date(0).toISOString();
    return [
      ...persistedMessages,
      ...(pendingUserText !== null
        ? [
            {
              role: 'user' as const,
              text: pendingUserText,
              sources: [] as AiSource[],
              toolCalls: [] as AiToolCall[],
              createdAt: stamp,
            },
          ]
        : []),
      ...(showStreamingOverlay && pendingUserText !== null
        ? [
            {
              role: 'assistant' as const,
              text: streamingText,
              sources: streamingSources,
              toolCalls: streamingToolCalls,
              createdAt: stamp,
              pending: status === 'streaming',
            },
          ]
        : []),
    ];
  }, [
    persistedMessages,
    pendingUserText,
    showStreamingOverlay,
    status,
    streamingText,
    streamingSources,
    streamingToolCalls,
  ]);

  const clear = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setStreamingText('');
    setStreamingSources([]);
    setStreamingToolCalls([]);
    setUsage(null);
    setError(null);
    setPendingUserText(null);
    await api('/ai/conversation/reset', { method: 'POST' });
    await queryClient.invalidateQueries({ queryKey: CONVERSATION_KEY });
  }, [queryClient]);

  const ask = useCallback(
    async (question: string, scope: AiScope = 'personal', scopeId?: string) => {
      // Cancel any previous stream — second ask before the first
      // finishes must not race two open connections.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      optimisticStartRef.current = new Date().toISOString();
      setStatus('streaming');
      setStreamingText('');
      setStreamingSources([]);
      setStreamingToolCalls([]);
      setUsage(null);
      setError(null);
      setPendingUserText(question);

      try {
        const response = await fetch(`${API_URL}/ai/ask`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          // Send the user's IANA timezone so the model anchors
          // "tomorrow 9am" to their LOCAL clock instead of UTC.
          // Without this, the model emits `T09:00:00Z` and the
          // calendar (which renders in the user's local zone)
          // shifts the event by the offset.
          body: JSON.stringify({
            question,
            scope,
            scopeId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const fallback = await response.text().catch(() => '');
          throw new Error(
            response.status === 503
              ? "AI isn't configured on this server yet."
              : `Couldn't reach the AI service (${response.status}). ${fallback}`,
          );
        }
        if (!response.body) {
          throw new Error("AI didn't return a streamable response.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) return;
          buffer += decoder.decode(value, { stream: true });

          // SSE event boundary is a blank line. Accept both LF and
          // CRLF — some proxies normalize one to the other and we
          // were dropping every event when that happened.
          for (;;) {
            const boundary = findEventBoundary(buffer);
            if (boundary === -1) break;
            const rawEvent = buffer.slice(0, boundary.end);
            buffer = buffer.slice(boundary.next);

            // Within an event block, concatenate every `data:` line —
            // SSE spec allows multi-line data fields. Also tolerate
            // `event:` / comment (`:`) lines by scanning per line
            // instead of requiring the block to start with `data:`.
            const dataLines: string[] = [];
            for (const line of rawEvent.split(/\r?\n/)) {
              if (line.startsWith('data:')) {
                dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
              }
            }
            if (dataLines.length === 0) continue;
            const json = dataLines.join('\n').trim();
            if (json.length === 0) continue;

            // Per-event try/catch — one malformed payload mustn't
            // tear down the whole stream.
            try {
              handleEvent(JSON.parse(json) as WireEvent);
            } catch (parseErr) {
              logger.warn('AI SSE parse failed for event', { json, error: parseErr });
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unexpected AI error.';
        setStatus('error');
        setError(message);
        setPendingUserText(null);
        toast.error('AI stream broke. Try again?', { description: message });
      }

      function handleEvent(event: WireEvent): void {
        switch (event.type) {
          case 'sources':
            setStreamingSources(flattenSources(event.sources));
            return;
          case 'token':
            setStreamingText((prev) => prev + event.text);
            return;
          case 'tool_call':
            // Stash the call so the bubble can render a confirm
            // widget (destructive) or a success chip (immediate).
            setStreamingToolCalls((prev) => [
              ...prev,
              {
                callId: event.callId,
                name: event.name,
                args: event.args,
                needsConfirmation: event.needsConfirmation,
                result: null,
                error: null,
                resolved: !event.needsConfirmation,
              },
            ]);
            return;
          case 'tool_result': {
            setStreamingToolCalls((prev) =>
              prev.map((t) =>
                t.callId === event.callId
                  ? { ...t, result: event.result, error: event.error, resolved: true }
                  : t,
              ),
            );
            // Side effects on success: refresh the user's calendar
            // cache so any open calendar surface picks up the new /
            // updated / deleted event, AND auto-open the AI capsule's
            // source pane scoped to the cited day if we can read the
            // event out of the result. Failures (event.error !==
            // null) skip both — the chip already shows the failure
            // state and we don't want to morph the pane on errors.
            if (event.error === null && event.result !== null) {
              const r = event.result as {
                eventId?: string;
                title?: string;
                startAt?: string;
                deleted?: boolean;
              };
              // Refresh every calendar view (personal + any channel).
              void queryClient.invalidateQueries({
                queryKey: qk.calendar.eventsRoot(null),
              });
              if (typeof r.eventId === 'string' && !r.deleted) {
                openSourcePane({
                  kind: 'event',
                  id: r.eventId,
                  title: typeof r.title === 'string' ? r.title : 'event',
                  startAt: typeof r.startAt === 'string' ? r.startAt : undefined,
                });
              }
            }
            return;
          }
          case 'done':
            setUsage(event.usage);
            setStatus('done');
            // Refetch and ONLY clear the streaming overlay once the
            // persisted version has landed. Clearing immediately left
            // a 200–600ms gap where the bubble had no source of text
            // (overlay gone, refetch in flight) — UI flickered from
            // "cooking" → empty → final message. Now the overlay
            // stays until the persisted refetch resolves, then a
            // single state update swaps the source cleanly.
            void queryClient.invalidateQueries({ queryKey: CONVERSATION_KEY }).finally(() => {
              optimisticStartRef.current = null;
              setStreamingText('');
              setStreamingSources([]);
              setStreamingToolCalls([]);
              setPendingUserText(null);
              // Flip back to idle now that the persisted version owns
              // the bubble. Leaving status as 'done' kept the overlay
              // logic ambiguous between "we still have something to
              // show" and "we're between turns".
              setStatus('idle');
            });
            return;
          case 'error':
            setStatus('error');
            setError(event.message);
            setPendingUserText(null);
            toast.error("AI couldn't answer that.", { description: event.message });
            return;
        }
      }
    },
    [queryClient, openSourcePane],
  );

  return {
    status,
    messages,
    isLoading: conversation.isLoading,
    usage,
    error,
    ask,
    clear,
  };
}
