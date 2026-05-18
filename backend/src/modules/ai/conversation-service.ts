import {
  AiConversation,
  AI_CONVERSATION_MAX_TURNS,
  type AiConversationDoc,
  type AiConversationMessage,
  type AiConversationScope,
  type AiConversationSource,
  type AiConversationToolCall,
} from '../../db/models/index.js';

/**
 * Conversation persistence. One conversation per (userId, scope,
 * scopeId). Always upserts so the caller never has to branch on
 * "first time" vs "returning". Trimming to `AI_CONVERSATION_MAX_TURNS`
 * happens on every push via `$slice` so the doc stays bounded
 * even under heavy use.
 */

export interface ConversationKey {
  userId: string;
  scope: AiConversationScope;
  scopeId?: string | null;
}

function keyFilter(key: ConversationKey): {
  userId: string;
  scope: AiConversationScope;
  scopeId: string | null;
} {
  return {
    userId: key.userId,
    scope: key.scope,
    scopeId: key.scopeId ?? null,
  };
}

/** Load (or create) the conversation for this key. */
export async function loadConversation(key: ConversationKey): Promise<AiConversationDoc> {
  const filter = keyFilter(key);
  const existing = await AiConversation.findOne(filter);
  if (existing) return existing;
  return AiConversation.create({ ...filter, messages: [] });
}

/** Wipe the messages for this key. Keeps the doc itself for index reuse. */
export async function resetConversation(key: ConversationKey): Promise<void> {
  await AiConversation.updateOne(keyFilter(key), { $set: { messages: [] } }, { upsert: true });
}

interface AppendArgs extends ConversationKey {
  role: 'user' | 'assistant';
  text: string;
  sources?: AiConversationSource[];
  toolCalls?: AiConversationToolCall[];
}

/**
 * Append one turn. Uses `$push` with `$slice: -MAX` so the oldest
 * turns drop off automatically. Atomic — safe under concurrent
 * writes (multi-tab, multi-device).
 */
export async function appendTurn(args: AppendArgs): Promise<void> {
  const message: AiConversationMessage = {
    role: args.role,
    text: args.text,
    createdAt: new Date(),
    ...(args.sources ? { sources: args.sources } : {}),
    ...(args.toolCalls ? { toolCalls: args.toolCalls } : {}),
  };
  await AiConversation.updateOne(
    keyFilter(args),
    {
      $push: {
        messages: { $each: [message], $slice: -AI_CONVERSATION_MAX_TURNS },
      },
    },
    { upsert: true },
  );
}

/**
 * Return the last N turns as plain message rows. Used by the
 * context-builder to feed prior turns into the prompt without
 * blowing the token budget — N caps at a hard 50 (the doc's own
 * `AI_CONVERSATION_MAX_TURNS` cap) regardless of the caller's
 * request so a future bug can't ask for an unbounded slice.
 */
export async function recentTurns(
  key: ConversationKey,
  n = 10,
): Promise<AiConversationMessage[]> {
  const cappedN = Math.max(1, Math.min(n, 50));
  const doc = await AiConversation.findOne(
    keyFilter(key),
    { messages: { $slice: -cappedN } },
  );
  return doc?.messages ?? [];
}

/**
 * Flip every `pending_confirmation` tool call older than `maxAgeMs`
 * to `declined` in this user's conversation. Used to prevent
 * stale pending calls from leaving unpaired `functionCall` parts
 * in the multi-turn history we ship to Gemini — Gemini 3 returns
 * a protocol error when a `functionCall` has no matching
 * `functionResponse`, and even Gemini 2.x degrades on it.
 *
 * Returns the number of tool calls flipped. Idempotent — calling
 * twice in a row makes no further change because the status is
 * no longer `pending_confirmation` after the first sweep.
 *
 * Uses a single arrayFilters update so the doc is written once
 * even when many calls are stale. Safe under the upsert pattern
 * `appendTurn` uses because the filter only matches existing
 * pending_confirmation entries.
 */
/**
 * Resolve a single pending tool call in-place: flip its status and
 * write back the result or error. Used by the confirm/decline route
 * so the next turn's `turnToContents()` reads the call as resolved
 * and emits the proper `functionCall` + `functionResponse` pair to
 * Gemini.
 *
 * Without this, a confirmed call stays `pending_confirmation` in
 * history → `turnToContents` skips it → the model has no record
 * the call ever happened and re-asks, or worse, mis-tracks state
 * on a follow-up ("did you move that event?" — model says "no, you
 * never confirmed"). Skipped silently for an hour, then auto-flipped
 * to `declined` by `expireStalePendingToolCalls` — still wrong if
 * the user actually confirmed.
 *
 * Matches the call by `callId` inside any message's `toolCalls`
 * array. Returns the number of documents modified (0 if the call
 * id no longer exists, e.g. message was trimmed by the rolling
 * $slice cap).
 */
export async function resolveToolCall(args: {
  key: ConversationKey;
  callId: string;
  status: 'executed' | 'failed' | 'declined';
  result?: Record<string, unknown> | null;
  error?: string | null;
}): Promise<number> {
  const { key, callId, status, result, error } = args;
  // Build the $set payload conditionally so we don't overwrite
  // result/error fields with `null` when not provided by the caller.
  const setOps: Record<string, unknown> = {
    'messages.$[msg].toolCalls.$[call].status': status,
  };
  if (result !== undefined) {
    setOps['messages.$[msg].toolCalls.$[call].result'] = result;
  }
  if (error !== undefined) {
    setOps['messages.$[msg].toolCalls.$[call].error'] = error;
  }
  const filter = {
    ...keyFilter(key),
    messages: {
      $elemMatch: { toolCalls: { $elemMatch: { callId } } },
    },
  };
  const updateResult = await AiConversation.updateOne(
    filter,
    { $set: setOps },
    {
      arrayFilters: [
        { 'msg.toolCalls.callId': callId },
        { 'call.callId': callId },
      ],
    },
  );
  return updateResult.modifiedCount;
}

export async function expireStalePendingToolCalls(
  key: ConversationKey,
  maxAgeMs: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  // Match ONLY docs that contain at least one stale pending call.
  // Without this gate, MongoDB tries to walk `messages.$[msg].toolCalls.$[call]`
  // for every matched message; messages without a `toolCalls` field
  // make the positional path resolve to undefined and the update fails
  // with "The path 'messages.0.toolCalls' must exist in the document
  // in order to apply array updates." The $elemMatch guarantees the
  // path exists on at least one element, and the arrayFilter below
  // constrains the walk to messages where `toolCalls` is actually an
  // array — together they make the update a no-op when there's
  // nothing to expire, instead of a crash.
  const filter = {
    ...keyFilter(key),
    messages: {
      $elemMatch: {
        createdAt: { $lt: cutoff },
        toolCalls: { $elemMatch: { status: 'pending_confirmation' } },
      },
    },
  };
  const result = await AiConversation.updateOne(
    filter,
    {
      $set: {
        'messages.$[msg].toolCalls.$[call].status': 'declined',
        'messages.$[msg].toolCalls.$[call].error': 'pending_confirmation_timeout',
      },
    },
    {
      arrayFilters: [
        // `msg.toolCalls.0: $exists` keeps the walk off messages
        // that have no toolCalls field at all — pairs with the
        // $elemMatch gate above for double protection.
        {
          'msg.createdAt': { $lt: cutoff },
          'msg.toolCalls.0': { $exists: true },
        },
        { 'call.status': 'pending_confirmation' },
      ],
    },
  );
  return result.modifiedCount;
}
