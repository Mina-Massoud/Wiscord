import { Schema, model, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * One conversation per `(userId, scope)` — v1 has just `personal`.
 * Holds a rolling list of message turns capped at 50 entries via
 * `$slice` on every push, so the doc can't grow unbounded.
 *
 * Sources and tool calls live on the assistant turn that produced
 * them — no separate collections. Citations are denormalised
 * because we want the chip labels to survive even if the
 * underlying note/event is renamed later.
 *
 * Future scopes (channel / server / voice) reuse the same shape;
 * the `(userId, scope, scopeId?)` triple keys the uniqueness.
 */

export const AI_CONVERSATION_SCOPES = ['personal', 'channel', 'server', 'voice'] as const;
export type AiConversationScope = (typeof AI_CONVERSATION_SCOPES)[number];

export const AI_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

/**
 * Mirrors the shape the SSE stream emits, so the frontend can
 * render persisted messages with the same chip components.
 */
export interface AiConversationSource {
  kind: 'note' | 'event' | 'attempt' | 'activity' | 'quiz' | 'web';
  id: string;
  title: string;
  /** Optional ISO datetime — populated for events so the inline
   *  calendar pane can open scoped to the right day on click. */
  startAt?: string;
  /** Optional channelId — populated for quiz citations so the
   *  frontend can build the workshop deep link without a separate
   *  lookup. The quiz lives under that channel. */
  channelId?: string;
  /** Optional URL — populated for `web` citations so the frontend
   *  can render the chip as an outbound link to the original page
   *  the model summarized for this turn. */
  url?: string;
}

export interface AiConversationToolCall {
  /** Our own id — opaque uuid the frontend uses for confirm/decline
   *  POSTs and to dedupe optimistic state. NOT the model's id. */
  callId: string;
  /** The model's own `functionCall.id` as emitted by Gemini, if it
   *  provided one. Required to be echoed back on the matching
   *  `functionResponse` part when we feed history to Gemini 2.5+ —
   *  the SDK uses it to map responses to calls across multi-turn
   *  exchanges. Gemini 3 hard-errors on a missing id; 2.5 degrades
   *  silently (drift, model loses tool-state). Optional on this
   *  schema for backward compat with rows written before this
   *  field existed — `turnToContents` omits the `id` field on the
   *  emitted parts when this is undefined, which 2.5 tolerates
   *  for legacy entries. */
  modelCallId?: string;
  name:
    | 'createCalendarEvent'
    | 'updateCalendarEvent'
    | 'deleteCalendarEvent'
    | 'createNote'
    | 'generateExam';
  args: Record<string, unknown>;
  status: 'pending_confirmation' | 'executed' | 'failed' | 'declined';
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export interface AiConversationMessage {
  role: AiMessageRole;
  text: string;
  sources?: AiConversationSource[];
  toolCalls?: AiConversationToolCall[];
  createdAt: Date;
}

export interface AiConversationShape {
  userId: string;
  scope: AiConversationScope;
  /** Optional scope target id (channelId / serverId / roomId).
   *  Null for `personal`. Future scopes use this to disambiguate. */
  scopeId: string | null;
  messages: AiConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ['note', 'event', 'attempt', 'activity', 'quiz', 'web'],
    },
    id: { type: String, required: true },
    title: { type: String, required: true },
    startAt: { type: String, default: undefined },
    channelId: { type: String, default: undefined },
    url: { type: String, default: undefined },
  },
  { _id: false },
);

const toolCallSchema = new Schema(
  {
    callId: { type: String, required: true },
    modelCallId: { type: String, default: undefined },
    name: {
      type: String,
      required: true,
      enum: [
        'createCalendarEvent',
        'updateCalendarEvent',
        'deleteCalendarEvent',
        'createNote',
        'generateExam',
      ],
    },
    args: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending_confirmation', 'executed', 'failed', 'declined'],
    },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    role: { type: String, required: true, enum: AI_MESSAGE_ROLES },
    text: { type: String, required: true, default: '' },
    sources: { type: [sourceSchema], default: undefined },
    toolCalls: { type: [toolCallSchema], default: undefined },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const aiConversationSchema = new Schema(
  {
    userId: { type: String, required: true },
    scope: { type: String, required: true, enum: AI_CONVERSATION_SCOPES },
    scopeId: { type: String, default: null },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true, collection: 'ai_conversations' },
);

// One conversation per (userId, scope, scopeId).
aiConversationSchema.index(
  { userId: 1, scope: 1, scopeId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } },
);

applySerialize(aiConversationSchema);

export type AiConversationDoc = HydratedDocument<AiConversationShape>;
export const AiConversation = model<AiConversationShape>('AiConversation', aiConversationSchema);

/** Soft cap on stored turns. Older turns are trimmed via $slice. */
export const AI_CONVERSATION_MAX_TURNS = 50;
