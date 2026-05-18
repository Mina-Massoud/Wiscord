# AI Research Findings — Wiscord Personal Assistant

**Date:** 2026-05-17
**Scope:** `@google/genai` v1.x (current: v2.3.0 as of May 2026), Gemma/Gemini models, personal AI scope

---

## Section 1 — Streaming Best Practices with `@google/genai` v1.x

### 1.1 Chunk Handling

The canonical streaming loop using `for await (const chunk of response)` is correct. The SDK's `chunk.text` getter concatenates all text parts on a chunk; it returns `undefined` (not `''`) when a chunk carries only a tool call or safety metadata — the current guard `typeof text === 'string' && text.length > 0` in `stream-personal.ts` handles this correctly.

One confirmed gap: unlike OpenAI and Anthropic SDKs, `@google/genai` has no built-in `waitForFinalResponseObject()` equivalent. `usageMetadata` is attached to chunks at varying points during the stream (not guaranteed to be on the final chunk only). The current approach in `stream-personal.ts` of holding `lastUsage` and overwriting each time a chunk carries `usageMetadata` is the correct workaround per community consensus.

- **Source:** https://discuss.ai.google.dev/t/how-to-stream-and-wait-for-the-final-response-object-with-the-new-genai-sdk/77507

### 1.2 The `finishReason` Set — Complete Enum

The `FinishReason` enum in `@google/genai` (from `src/types.ts`) contains significantly more values than the documentation typically shows. The full set as of SDK v2.x:

```
FINISH_REASON_UNSPECIFIED   — API default when reason unknown
STOP                         — Normal, clean completion
MAX_TOKENS                   — Hit maxOutputTokens ceiling; output is truncated
SAFETY                       — Blocked by a harm category filter
RECITATION                   — Detected copyrighted/training-data recitation
LANGUAGE                     — Unsupported language detected
OTHER                        — Catch-all unspecified reason
BLOCKLIST                    — Content matched a configured blocklist
PROHIBITED_CONTENT           — Policy-prohibited content category
SPII                         — Sensitive PII detected
MALFORMED_FUNCTION_CALL      — Model emitted a syntactically invalid tool call
IMAGE_SAFETY                 — Image-specific safety block (not applicable here)
UNEXPECTED_TOOL_CALL         — Model called a tool when none were registered
IMAGE_PROHIBITED_CONTENT     — Image-specific policy block
NO_IMAGE                     — Image generation produced no result
IMAGE_RECITATION             — Image-specific recitation
IMAGE_OTHER                  — Image catch-all
```

- **Source:** https://github.com/googleapis/js-genai/blob/main/src/types.ts (lines 530–580)

**Actionable:** The current `stream-personal.ts` captures `lastFinishReason` as a raw string but never acts on it. Two values matter for the Wiscord personal assistant:

- `MALFORMED_FUNCTION_CALL` — the model tried to call a tool but produced invalid JSON args. The stream will have zero text tokens and zero valid `functionCalls`. The route layer receives a `done` event with no `token` events — the user sees a blank response unless the route catches this. **Recommendation:** after the stream loop, inspect `lastFinishReason`; if it equals `MALFORMED_FUNCTION_CALL` or `SAFETY` and `assistantText` is empty, yield an explicit `error` event (or a safe fallback token like `"something went sideways, try again"`) before yielding `done`.

- `MAX_TOKENS` — output was cut mid-sentence. The current `maxOutputTokens: 1536` is tight enough that verbose grounded replies can hit this. **Recommendation:** log a warning when `finishReason === 'MAX_TOKENS'` and `totalTokenCount` is near the limit; consider raising the cap to 2048 for grounded turns.

### 1.3 Mid-Stream Tool Calls

Tool calls in Gemini streaming do not interleave with text chunks the way they do in some other providers. Gemini typically emits one chunk containing the `functionCall` part with no `text`. The SDK's `chunk.functionCalls` accessor (an array) is the correct surface — this is what `stream-personal.ts` uses. This is correct.

Known footgun: if the model simultaneously emits both a text part and a `functionCall` part on the same chunk (possible when `temperature > 0`), `chunk.text` will still be non-empty. The current code handles both on the same iteration of the loop, which is correct.

- **Source:** https://ai.google.dev/gemini-api/docs/function-calling

### 1.4 Error / Retry

The SDK throws synchronously from the `generateContentStream` call (e.g., network errors, 429 rate limit, 503 model unavailable) before the async iterator begins. The current pattern wraps the entire `for await` loop in `try/catch`, which catches both pre-stream throws and mid-stream errors — this is correct. There is no built-in SDK retry; retries must be implemented by the caller.

Known issue: LiteLLM and other wrappers have been observed silently normalizing `MALFORMED_FUNCTION_CALL` to `stop`, masking errors. The Wiscord implementation uses the SDK directly so this masking does not apply.

- **Source:** https://github.com/BerriAI/litellm/issues/21744

### 1.5 Prompt Caching — Gemma Models

**Context caching is NOT available for Gemma models on the Gemini API.** The caching documentation lists only Gemini 3 Flash/Pro Preview and Gemini 2.5 Flash/Pro as supported models. No Gemma variant appears in the supported list.

Implicit caching (zero-config, opportunistic) is enabled by default for Gemini 2.5+ models but does not apply to Gemma.

The existing comment in `context-builder.ts` ("cheap if context-caching isn't available for the Gemma variants") and `maybeLogCacheGap` in `stream-personal.ts` are correct — no explicit caching code should be added for Gemma targets.

If `GEMINI_MODEL` is ever changed to a Gemini 2.5 Flash target, implicit caching would kick in automatically for the stable system prompt portion (the `PERSONAL_SYSTEM_PROMPT` string, which is constant across users). That would be a free win requiring no code change.

- **Source:** https://ai.google.dev/gemini-api/docs/caching
- **Source:** https://www.aifreeapi.com/en/posts/gemini-api-context-caching-reduce-cost

---

## Section 2 — Multi-Turn Tool-Use State Preservation

### 2.1 Recommended Pattern

The Gemini API requires a strict alternating structure in `contents` when tool calls are involved:

```
{ role: 'user',  parts: [{ text: '...' }] }
{ role: 'model', parts: [{ functionCall: { name, args } }] }
{ role: 'user',  parts: [{ functionResponse: { name, response } }] }
{ role: 'model', parts: [{ text: '...' }] }   // final answer
```

The `turnToContents()` function in `service.ts` implements exactly this pattern. It is correct.

### 2.2 The `id` Field — Critical Breaking Change in Gemini 3

Gemini 3 models now generate a unique `id` on every `functionCall`. When sending back the `functionResponse`, the `id` must be included so the API can map the result to the correct call. **The official JS SDK handles this automatically** when using `chunk.functionCalls` — the SDK preserves the `id` in the call object. Since `stream-personal.ts` surfaces `call.name` and `call.args` but discards the call object itself, if you ever move to a Gemini 3 model and construct `functionResponse` parts manually, you must also carry the `id`.

**Actionable:** The current code does not persist the raw `functionCall` part from the chunk — it only stores `name` and `args` in `AiConversationMessage`. If the SDK is used end-to-end for replay (i.e., the SDK auto-adds `functionResponse` from stored data), this is fine. If `turnToContents()` is manually constructing `functionResponse` parts (which it is), test with a Gemini 3 target to confirm the SDK fills in the `id` automatically or whether `id` needs to be stored alongside the tool call record.

- **Source:** https://ai.google.dev/gemini-api/docs/function-calling

### 2.3 Common Breakages

**Unmatched `functionCall` without `functionResponse`:** Emitting a `functionCall` part in history that has no corresponding `functionResponse` breaks the model's state — it either errors or ignores subsequent instructions. The current `turnToContents()` skips tool calls whose `status === 'pending_confirmation'`. This is correct: a pending call that was never confirmed/declined would produce an orphaned `functionCall` in history. However, if the user closes the session mid-confirmation, those pending calls remain in the DB. If they're ever replayed into a new session's `contents`, the mismatch will cause failures. **Recommendation:** on session load, mark any `pending_confirmation` calls older than 1 hour as `declined` so they're emitted as `functionCall + functionResponse(declined: true)` pairs rather than omitted.

**Tool calls during chit-chat history rebuild:** When `ctx.chitChat === true`, `service.ts` correctly drops all prior history. This prevents a prior turn's `functionCall` from being emitted without its paired `functionResponse`.

**`UNEXPECTED_TOOL_CALL` finishReason:** This occurs when the model attempts to call a tool on a turn where `tools` was not passed (e.g., if `config.tools` is conditionally omitted). The current code always passes `CALENDAR_TOOLS` — this is safe and avoids this error. A related Python SDK bug (`automatic_function_calling` config persisting across requests with `tools=None`) does not apply to the JS SDK, but be aware if this changes.

- **Source:** https://github.com/googleapis/python-genai/issues/1818
- **Source:** https://github.com/google-gemini/gemini-cli/issues/5705

### 2.4 `MALFORMED_FUNCTION_CALL` Handling

When the model produces invalid tool call JSON (e.g., an arg value that exceeds the JSON size limit, or a hallucinated tool name), the stream ends with `finishReason: MALFORMED_FUNCTION_CALL`. The `chunk.functionCalls` array will be empty or contain a malformed entry. The current code skips unknown tool names (`isKnownToolName` check) but does not check whether `finishReason` is `MALFORMED_FUNCTION_CALL`. If the model hallucinated a call to an unknown tool, the turn yields nothing — zero tokens, zero tool events — and the user sees a blank response.

**Recommendation:** After the stream loop in `service.ts`, check if `assistantText` is empty and no tool calls were dispatched; if so, yield a fallback `token` event with a short error-tone message ("something got jumbled, try again") to prevent a silent blank turn. Alternatively, surface the `finishReason` on the `done` event so the frontend can render a contextual message.

- **Source:** https://discuss.ai.google.dev/t/getting-finishreason-malformed-function-call-when-function-calling-arugments-contain-large-amount-of-text-content/69488

---

## Section 3 — Small-Model Prompt Design (Gemma 4 / Gemma 3 27B)

### 3.1 System Prompt Handling via the Gemini API

Gemma's native format does not support a `system` role — only `user` and `model` turns exist in the raw template. However, **when accessing Gemma through the Gemini API**, the `systemInstruction` field in the SDK config IS supported server-side: the API injects it appropriately before serving the model. The current code passes `config.systemInstruction: systemPrompt` — this is correct for Gemma-via-Gemini-API.

The critical caveat: `systemInstruction` must be passed inside the `config` object, not at the top level of the request. Placing it at the top level causes it to be silently ignored. The current `stream-personal.ts` call structure places it correctly inside `config`.

- **Source:** https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
- **Source:** https://gemilab.net/en/articles/gemini-api/gemini-api-system-instruction-ignored-troubleshooting

### 3.2 System Prompt Size Trade-offs

For small models (Gemma 3 27B, Gemma 4 26B), larger system prompts have higher per-token attention cost relative to the completion budget. The combined `WISCORD_VOICE_RULES + PERSONAL_SCOPE_RULES + VOICE_ANCHORS` prompt is approximately 1,100–1,300 tokens. With `maxOutputTokens: 1536` and Gemma's effective context window (8K for 27B, 128K for Gemma 3 / Gemma 4), this is not a concern for the personal scope.

However, the RAG data block (notes × 1,500 chars each × 8 notes = up to ~3,000 tokens plus events/attempts/activities) adds another ~3,500–4,000 tokens to the user turn. Total context per grounded turn: ~5,500–6,500 tokens — well within Gemma 3's 128K window and Gemma 4's 256K window. No size reduction is needed for current caps.

**Recommendation:** if `GEMINI_MODEL` resolves to Gemma 3 27B (the 8K window variant), reduce `noteCharsEach` from 1,500 to 800 and `notes` limit from 8 to 5 to stay safely under the 8K ceiling even with conversation history added. For Gemma 4 26B or any model with 128K+, current caps are fine.

### 3.3 Few-Shot Anchors vs. Inline Instructions

Research on small models confirms that few-shot examples demonstrably outperform zero-shot instructions for style/register fidelity. The current `VOICE_ANCHORS` block provides 11 examples covering chit-chat, citation, calendar cite, quiz cite, broad ask, and empty-data. This is in the right range — studies suggest 4–8 examples begin to saturate marginal gains for tone enforcement; beyond ~12, you pay token cost for diminishing returns.

The current anchor placement (end of system prompt, after scope rules) follows the general guidance that end-of-context placement gets higher attention weight due to recency bias. This is the best position for the anchors given the U-shaped attention distribution of transformer models.

**Recommendation:** Keep the current anchor count (11). Do not expand. The token cost of adding more anchors is better spent on data blocks for grounded turns.

- **Source:** https://web.dev/articles/practical-prompt-engineering
- **Source:** https://www.promptingguide.ai/models/gemma

### 3.4 In-Context Contamination Mitigations

The codebase already implements the most important mitigations:

1. **Chit-chat history drop** (`ctx.chitChat === true` → empty `contents`) — prevents a bad prior reply from being parroted via in-context learning.
2. **Tail reminder** in `assembleUserPrompt` — end-of-prompt instructions override mid-context patterns; "Do not imitate your prior assistant turns if they violate these rules. The rules win."
3. **Data/history separation on chit-chat** — the `assembleChitChatPrompt` path provides no source IDs, making citation chips physically impossible.

Additional mitigations worth considering:

- **History truncation by age:** The current `recentTurns(..., 11)` cap is turn-count based, not time-based. A 3-week-old turn with a bad reply could still poison history. Consider capping history to turns within the last 7 days in addition to the count cap.
- **Assistant turn scrubbing:** When replaying prior assistant turns into `contents`, consider stripping any citation brackets (`[note:...]`) from the text before re-emitting them. This prevents the model from reinforcing a hallucinated citation pattern it saw in its own prior output.

---

## Section 4 — RAG-Lite (Filter + Sort + Cap) Pitfalls

### 4.1 The "Lost in the Middle" Effect

The Stanford/UC Berkeley "Lost in the Middle" paper (2023, arxiv:2307.03172) establishes that LLMs exhibit a U-shaped attention distribution over their context window: tokens near the beginning and end receive disproportionate attention, while content in the middle is underweighted.

**Current layout (ground turn user prompt):**
```
=== NOW ===          ← beginning, high attention
=== MY NOTES ===     ← beginning-ish, moderate attention
=== MY CALENDAR === ← middle
=== MY QUIZ ===      ← middle
=== MY VOICE ===     ← middle
=== QUESTION ===     ← end
=== HOW TO ANSWER === ← end, high attention
```

Calendar events and quiz attempts land in the middle of the data block, which is also the middle of the user turn. For questions specifically about calendar or quizzes, the relevant data starts in the attention trough.

**Recommendation:** Dynamically reorder data blocks based on the question's likely intent. If `DATA_KEYWORDS_RE` matches `calendar|event|schedule`, place the events block first. If it matches `quiz|attempt|score`, place attempts first. Notes first is a sensible default since they're the most frequently cited signal. This is a low-cost code change in `assembleUserPrompt` that meaningfully improves grounded answer quality for non-note queries.

- **Source:** https://arxiv.org/abs/2307.03172
- **Source:** https://www.thousandmiles.ai/blog/lost-in-the-middle-llm-context

### 4.2 Stale Data and Window Staleness

The calendar window is `−7 days → +14 days` from now. A user asking "what's on my calendar this week?" on a Thursday will get events from the prior Monday (−3 days) included, but a Friday question about "last week" requires the lookback to reach −7 days minimum. The current window is adequate for forward queries but can miss recent-past events for backward-looking questions ("what did I have last Monday?"). This is an accepted trade-off given the cap.

More important: notes are fetched by `updatedBy: userId, sort: updatedAt desc` — there is no staleness filter. A note last edited 6 months ago can crowd out fresher notes. The `updatedAt` is surfaced in the prompt block (`(updated ${n.updatedAt})`), allowing the model to reason about freshness, but the model may still cite a stale note confidently if it matches the question keyword.

**Recommendation:** Consider adding a 60-day staleness filter to notes retrieval — `updatedAt: { $gte: sixtyDaysAgo }` — with a fallback to the unconstrained query if the filtered result returns fewer than 3 notes. Alternatively, surface the age delta in a human-readable form ("updated 45 days ago") rather than a raw ISO timestamp so the model treats it as a freshness signal.

### 4.3 Context Over-Population and Dilution

The current caps (8 notes × 1,500 chars, 20 events, 5 attempts, 5 activities) mean a maximum of ~12,000 chars in the data blocks before the question. With dense note content, this can approach 3,000–4,000 prompt tokens for the data portion alone.

**Anti-pattern:** The "indiscriminate top-k" problem — pulling all 8 notes regardless of relevance to the question. Without embeddings, there's no similarity signal, so every note is equally likely to be stuffed in regardless of relevance. A question about "tomorrow's physics exam" pulls the Yjs note about IELTS writing and the calculus deck alongside the physics notes.

**Recommendation:** Add a lightweight keyword filter for notes retrieval. Extract significant tokens from the question (after stripping stopwords), and use a MongoDB `$text` search or a simple `{ content: { $regex: stemmedKeyword } }` against note content before sorting by `updatedAt`. This doesn't require embeddings and significantly improves precision for grounded questions. As a simpler first step: if `DATA_KEYWORDS_RE` produces a subject keyword (e.g., "physics", "calc"), filter notes by a case-insensitive match on the stored title before falling back to recency ordering.

- **Source:** https://medium.com/@2nick2patel2/llm-rag-anti-patterns-stop-stuffing-context-c79c11a2529d

### 4.4 Hallucination from Absence

When the user asks a grounded question and the answer genuinely isn't in the context, the model is instructed to say "not in the context" (PERSONAL_SCOPE_RULES and the tail HOW TO ANSWER block). This is correct. The main risk is when the data is *partially* present — e.g., the model sees a note titled "Physics exam" but not the content — and fabricates details from prior training.

The `(empty)` placeholder in the notes block (when `getNotePlaintext` returns empty) is correct: it tells the model the note exists but has no content, preventing the model from hallucinating content while still surfacing the note as a citation target. Keep this.

---

## Section 5 — Known Issues / Footguns with `@google/genai` TypeScript SDK v1.x

### 5.1 SDK Version Note

The SDK version jumped from `v1.x` to `v2.x` nomenclature around May 2026 (current: v2.3.0 on npm). The underlying `@google/genai` package is the same — this is not a breaking rename, just a version bump. The `package.json` dependency should be checked to ensure it is pinned to a range that includes the current stable (≥1.52.0 or ≥2.0.0).

- **Source:** https://github.com/googleapis/js-genai/releases

### 5.2 Non-Standard JSON Schema Implementation

The SDK uses uppercased type enums (`Type.OBJECT`, `Type.STRING`, `Type.BOOLEAN`) rather than JSON Schema's lowercase strings (`"object"`, `"string"`). This is a deliberate Google design choice, not a bug, but it means the tool declaration schemas in `stream-personal.ts` are not portable to other libraries expecting standard JSON Schema. Additionally, `additionalProperties` is not supported in function parameter schemas — the API silently ignores it. This is already handled correctly in the codebase.

- **Source:** https://github.com/googleapis/js-genai/issues/293

### 5.3 `usageMetadata` Gaps on Certain Chunk Types

`usageMetadata.cachedContentTokenCount` is absent (not zero, but `undefined`) on responses from models that don't support caching — including Gemma. The `maybeLogCacheGap` function in `stream-personal.ts` already accounts for this. The broader issue is that `usageMetadata` on tool-call chunks may be `undefined` entirely (the SDK only attaches it to the final or near-final text chunk). The current pattern of holding `lastUsage` across all chunks and using the last observed value is the correct workaround.

### 5.4 `seed` Parameter Has No Effect

The `seed` parameter in `GenerationConfig` has no effect as of 2026 — identical seeds produce different outputs. Do not attempt to use `seed` for deterministic responses in tests.

- **Source:** https://github.com/googleapis/js-genai/issues/293

### 5.5 Interactions API — Do Not Use (Beta)

The `Interactions` API (for multi-turn managed sessions) is in Beta and carries explicit breaking-change warnings. SSE events were renamed between minor versions (e.g., `interaction.created` → `interaction.completed` naming changes in May 2026). The current Wiscord implementation correctly uses `models.generateContentStream` directly rather than the Interactions API — this is the stable surface.

- **Source:** https://dev.to/asross311/taming-the-interactions-api-in-the-googlegenai-sdk-561b

### 5.6 `gemini-2.0-flash` Caching Returns 404

If `GEMINI_MODEL` is ever set to `gemini-2.0-flash` or `gemini-2.0-flash-exp` and explicit `createCachedContent` is attempted, the API returns 404 with a model-not-found message. Implicit caching applies to Gemini 2.5+ only. Never add explicit caching calls for flash-2.0 or Gemma targets.

- **Source:** https://github.com/googleapis/js-genai/issues/293

### 5.7 `functionCalls` Accessor is Not in Official TypeScript Types

The `chunk.functionCalls` accessor used in `stream-personal.ts` is cast with a manual type annotation `(chunk as { functionCalls?: Array<...> })`. This is because the TypeScript types shipped with the SDK (autogenerated from protobuf) do not always expose `functionCalls` as a top-level typed accessor on streaming chunks. This cast is correct as a workaround — the field exists at runtime. Watch for it to become properly typed in a future SDK release, at which point the cast can be removed.

### 5.8 `MALFORMED_FUNCTION_CALL` Can Produce Null `content` on Candidate

When a streaming response ends with `MALFORMED_FUNCTION_CALL`, `candidate.content` can be `null` (the model produced no valid content object). Attempting to iterate `candidate.content.parts` will throw. The SDK's `chunk.text` getter guards against this (it returns `undefined` on null content), but any code that accesses `chunk.candidates[0].content.parts` directly will crash. The current codebase does not do this — it uses `chunk.text` and `chunk.functionCalls` — so this footgun does not apply, but is worth knowing for future diagnostics.

- **Source:** https://github.com/elastic/kibana/issues/227096

---

## Summary of Top Three Actionable Recommendations

1. **Surface `finishReason` on empty completions** (`stream-personal.ts`, `service.ts`): After the stream loop, if `assistantText` is empty and no tool calls were dispatched, check `lastFinishReason`. For `MALFORMED_FUNCTION_CALL` and `SAFETY`, yield a fallback token event with a short user-facing message before emitting `done`. Without this, the frontend receives a blank response with no explanation. Add `finishReason` as an optional field on the `done` event shape so the route layer can also log it.

2. **Reorder data blocks dynamically by query intent** (`context-builder.ts`, `assembleUserPrompt`): Extend the existing `DATA_KEYWORDS_RE` match to also classify the dominant data surface (notes vs. calendar vs. quiz). Place the most-relevant block first in the user prompt. The "lost in the middle" attention effect is well-documented and this is a zero-cost fix that improves grounded answer precision, especially for calendar and quiz questions.

3. **Mark stale `pending_confirmation` tool calls as `declined`** (`service.ts`, `conversation-service.ts`): On session load (or when building `contents` in `turnToContents`), any tool call with `status === 'pending_confirmation'` older than a configurable threshold (suggest 1 hour) should be treated as `declined`. Currently, these calls are silently skipped in `turnToContents`, which means the corresponding `functionCall` part in a prior model turn is emitted without a matching `functionResponse`. For Gemini 3 models (which are stricter about turn structure), this silent omission will cause API errors. Explicitly emitting `functionResponse({ declined: true })` for timed-out pending calls makes the history valid across all model versions.

---

## Sources

- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/caching
- https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
- https://ai.google.dev/gemma/docs/core/prompt-structure
- https://github.com/googleapis/js-genai/blob/main/src/types.ts
- https://github.com/googleapis/js-genai/issues/293
- https://github.com/googleapis/js-genai/releases
- https://discuss.ai.google.dev/t/how-to-stream-and-wait-for-the-final-response-object-with-the-new-genai-sdk/77507
- https://discuss.ai.google.dev/t/getting-finishreason-malformed-function-call-when-function-calling-arugments-contain-large-amount-of-text-content/69488
- https://github.com/google-gemini/gemini-cli/issues/5705
- https://github.com/googleapis/python-genai/issues/1818
- https://github.com/elastic/kibana/issues/227096
- https://github.com/BerriAI/litellm/issues/21744
- https://gemilab.net/en/articles/gemini-api/gemini-api-response-truncated-incomplete-fix
- https://gemilab.net/en/articles/gemini-api/gemini-api-system-instruction-ignored-troubleshooting
- https://arxiv.org/abs/2307.03172
- https://www.thousandmiles.ai/blog/lost-in-the-middle-llm-context
- https://medium.com/@2nick2patel2/llm-rag-anti-patterns-stop-stuffing-context-c79c11a2529d
- https://web.dev/articles/practical-prompt-engineering
- https://www.promptingguide.ai/models/gemma
- https://www.aifreeapi.com/en/posts/gemini-api-context-caching-reduce-cost
- https://dev.to/asross311/taming-the-interactions-api-in-the-googlegenai-sdk-561b
