# Gemini 2.5 Flash-Lite — Wiscord AI Findings

Researched: 2026-05-17  
Model in production: `gemini-2.5-flash-lite` via `@google/genai` v1.52  
SDK call site: `client.models.generateContentStream`

---

## Q1 — Is Flash Lite the right model for this workload?

### What the docs say

**Capability tiers (sourced from official model docs and benchmark aggregator data):**

| Dimension | Flash Lite | Flash (non-Lite) | 2.0 Flash |
|---|---|---|---|
| Global-MMLU-Lite | 81.1% | 88.4% | deprecated |
| GPQA (reasoning) | 64.6% | 82.8% | deprecated |
| SWE-Bench (code) | 31.6% | 60.4% | deprecated |
| AIME 2025 (math) | 49.8% | 72.0% | deprecated |
| SimpleQA (factual) | 10.7% | 26.9% | deprecated |
| Output token limit | 65,536 | 65,536 | — |
| Context window | 1M | 1M | — |
| Thinking support | Yes (opt-in, thinkingBudget) | Yes (auto + configurable) | No |
| Tool / function calling | Yes | Yes | Yes (deprecated) |

Sources:
- [llm-stats.com Flash vs Flash Lite comparison](https://llm-stats.com/models/compare/gemini-2.5-flash-vs-gemini-2.5-flash-lite)
- [Google AI Models overview](https://ai.google.dev/gemini-api/docs/models)
- [Google Cloud Flash Lite page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite)

**Pricing (Google AI Developer API, standard tier, per 1M tokens):**

| Model | Input | Output | Notes |
|---|---|---|---|
| gemini-2.5-flash-lite | $0.10 | $0.40 | Most cost-effective in 2.5 family |
| gemini-2.5-flash | $0.30 | $2.50 | 3× input, 6.3× output vs Lite |
| gemini-2.0-flash | $0.10 | $0.40 | **Deprecated — shuts down June 1, 2026** |

Source: [Gemini API Pricing page](https://ai.google.dev/gemini-api/docs/pricing)

**Latency:** Flash Lite streams at ~393 tokens/sec with ~0.29s TTFT. Flash (non-Lite) is slower but still sub-second TTFT in typical conditions. Flash Lite is positioned as "1.5× faster than 2.0 Flash."

Source: [the-decoder.com Flash Lite overview](https://the-decoder.com/gemini-2-5-flash-lite-is-the-fastest-and-most-cost-effective-model-in-googles-gemini-lineup/)

**Google's stated intended use for Flash Lite:** "high-volume classification, simple data extraction, and extremely low-latency applications." The blog post positioning Flash Lite explicitly separates it from "responsive chat applications" (that use case is attributed to Flash non-Lite).

Source: [Google Cloud Blog — Gemini 2.5 Flash/Pro GA](https://cloud.google.com/blog/products/ai-machine-learning/gemini-2-5-flash-lite-flash-pro-ga-vertex-ai)

**Known issues with Flash Lite:**
- Structured output / JSON wrapping bug (markdown fences in output) documented late 2025, resolved by December 2025.
- Instruction following degradation reported after version bumps; google acknowledged and addressed in preview-09-2025 update.
- No Live API support (not relevant for SSE streaming).

Source: [Developer forum — Flash Lite structured output issue](https://discuss.ai.google.dev/t/gemini-2-5-flash-lite-produces-incorrect-structured-output/102367)

### What the current code does

- `env.GEMINI_MODEL` — not hardcoded, pulled from env. Assumed to be `gemini-2.5-flash-lite` per the prompt.
- Call site: `/Users/mina/Documents/Mina/Wiscord/backend/src/modules/ai/provider/stream-personal.ts` line 140.
- No thinking config is set — so Flash Lite defaults to **thinking disabled** (the model does not think unless `thinkingBudget >= 512` is explicitly set).

### Recommendation

**Upgrade to `gemini-2.5-flash` for this specific workload.**

The Wiscord AI mate is NOT a classification or simple extraction task. It is a multi-turn conversational persona with dark-humor register, elliptical follow-up handling, few-shot generalization, and tool-use reliability requirements. Flash Lite's benchmark gaps on reasoning (GPQA: -18 points) and instruction following degrade exactly the capabilities the product depends on:

1. Multi-turn conversational coherence — Flash is the model Google recommends for "responsive chat applications." Flash Lite is explicitly not positioned for this.
2. Register fidelity — The gap in GPQA and SimpleQA means Flash Lite has weaker world-model inference, which directly hurts its ability to "read between the lines" (the `gf got engaged` subtext case).
3. Tool-use reliability — Reasoning quality correlates directly with correct argument generation. The 22-point AIME gap is a proxy for the structured-output reliability difference.
4. Cost impact — Output cost goes from $0.40/1M to $2.50/1M, but Wiscord's 1–2 sentence chat replies with `maxOutputTokens: 1536` cap mean actual output volume is tiny. At $2.50/1M output tokens, a 100-token reply costs $0.00025. The 6.3× output cost difference is negligible for this reply-length distribution.

If cost is a hard constraint, a hybrid approach is viable: route `conversation` and `greeting` mode turns to Flash Lite (short, low-stakes replies), route `grounded` and any tool-call turns to Flash (requires reasoning + tool args). The `ctx.mode` value returned by `buildPersonalContext` makes this routing trivial to implement in `stream-personal.ts`.

**Apply at:** `/Users/mina/Documents/Mina/Wiscord/backend/src/modules/ai/provider/stream-personal.ts` line 142 — change `model: env.GEMINI_MODEL` to support per-mode model selection, or update `GEMINI_MODEL` env var to `gemini-2.5-flash`.

---

## Q2 — System prompt size + few-shot anchor design

### What the docs say

**Overfitting warning (exact wording from official docs):**
> "if you include too many examples, the model might start to overfit the response to the examples."

Source: [Google Cloud — Include few-shot examples](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/few-shot-examples)

**Placement guidance:** Google's official documentation does not specify whether few-shot examples should be in the system instruction vs. the `contents` array as prefill turns. Community practice (discussed in the developer forum) splits into two camps: (a) all examples bundled in a single initial prompt or system instruction; (b) examples as synthetic `{role: user} / {role: model}` turn pairs prepended to the `contents` array. Forum consensus: "your mileage may vary — test both in AI Studio."

Source: [Developer forum — Few-shot best practices](https://discuss.ai.google.dev/t/few-shot-best-practices-and-experiences/41521)

**Long system prompt guidance:** Google recommends placing "essential behavioral constraints, role definitions (persona), and output format requirements in the System Instruction or at the very beginning of the user prompt." For large context: "supply all the context first. Place your specific instructions or questions at the very end of the prompt." There is no documented token threshold at which Flash Lite degrades on system instruction length.

Source: [Gemini prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)

**Flash Lite and instruction following:** The model card and developer forum confirm Flash Lite preview-09-2025 specifically addressed instruction following improvements and "reduced verbosity." However, even after improvements, Flash Lite trails Flash non-Lite on every reasoning benchmark — instruction adherence on nuanced, multi-constraint persona prompts is harder for the smaller model.

Source: [Search result citing Flash Lite instruction following improvements](https://discuss.ai.google.dev/t/gemini-2-5-flash-quality-degradation-based-on-internal-evals/94561)

**Verbatim copying root cause (inference — no primary source):** The official docs do not directly discuss verbatim example copying as a failure mode. However, the overfitting warning is directly relevant. When few-shot anchors are embedded in the system instruction and the user's message structurally matches an anchor's `Q:` line, the model's loss-minimizing behavior at inference is to complete the pattern with the memorized `A:` line. This is the expected failure mode of in-context overfitting. The model is doing what the docs warn against: it has overfit the specific Q→A pattern rather than generalizing the voice.

### What the current code does

- `WISCORD_VOICE_RULES` + `PERSONAL_SCOPE_RULES` + `VOICE_ANCHORS` are concatenated by `composeSystemPrompt()` in `voice.ts` line 199.
- All few-shot anchors live inside the system instruction (`config.systemInstruction`), embedded as literal `Q: ... / A: ...` text blocks.
- The current anchors include threads A–F plus standalone greetings — approximately 8–10 distinct Q/A or multi-turn thread patterns.
- `voice.ts` lines 47–51 already include explicit anti-verbatim-copying instructions (`DO NOT COPY THE EXAMPLES VERBATIM`). This is the right instinct but it competes with the model's in-context learning pull toward the memorized A: line.

### Recommendation

**Move the few-shot anchors out of the system instruction and into the `contents` array as prefill turns.**

The core problem is that system instruction anchors are part of the model's "context" for every single turn. When the user's message structurally resembles an anchor, the model is simultaneously reading "DO NOT COPY THIS" and seeing the exact Q→A pairing — the pattern completes. Moving anchors into the `contents` array as explicit `{role: 'user'} / {role: 'model'}` pairs at position 0 is the semantically correct representation: they are synthetic conversation examples, not behavioral rules. This also:

1. Keeps the system instruction shorter and more focused on rules only (persona, banned behaviors, citation format). Shorter, more imperative system instructions are more reliably followed.
2. Anchors in the `contents` array are "older" turns — when real conversation history accumulates, they get displaced toward the distant past, reducing overfitting to them on current turns.
3. Separates "what the voice sounds like" (anchors, as content) from "what the rules are" (system instruction). Gemini respects this distinction more reliably than a mixed single block.

**Anchor count:** Current count is appropriate (8–10 threads). Official guidance says "a few examples" can overfit, but does not define "a few" precisely. The existing threads are well-varied across situation types. The bigger problem is placement, not count. If verbatim copying persists after moving to prefill, reduce to 5–6 anchors covering the most distinct patterns (greeting, elliptical follow-up, dark humor vent, grounded cite, tool-use ack).

**Apply at:**
- `/Users/mina/Documents/Mina/Wiscord/backend/src/modules/ai/voice.ts` — refactor `VOICE_ANCHORS` from a string to be injected into `contents` instead of appended to `systemInstruction`.
- `/Users/mina/Documents/Mina/Wiscord/backend/src/modules/ai/provider/stream-personal.ts` line 140–151 — prepend anchor turns to `contents` before history turns (but after system instruction is set separately).
- `/Users/mina/Documents/Mina/Wiscord/backend/src/modules/ai/context-builder.ts` line 382 — `PERSONAL_SYSTEM_PROMPT` currently calls `composeSystemPrompt(PERSONAL_SCOPE_RULES)` which embeds anchors. After refactor, this should call a version that omits anchors.

---

## Q3 — Generation config tuning for Flash Lite

### What the docs say

**Temperature:** The official Gemini API text generation docs state: "When using Gemini 3 models, we strongly recommend keeping the temperature at its default value of 1.0." For 2.5 models, the same page provides no analogous strong recommendation, and the default is documented as `1.0`. The general guidance is "Lower temperatures are good for prompts that require a more deterministic or less open-ended response."

Source: [Gemini generateContent API docs](https://ai.google.dev/gemini-api/docs/text-generation)

**topK on 2.5 models:** Community discussion confirms topK does function on 2.5 models, but temperature is the dominant parameter. Setting topK to 1 while keeping temperature high still produces variability. The relationship between topK, topP, and temperature follows sampling order: topK filters the candidate pool, then topP further filters, then temperature controls final sampling. Official guidance: "adjust either temperature or topP, but not both."

Source: [Developer forum — Does topK affect 2.5 models](https://discuss.ai.google.dev/t/does-the-top-k-parameter-affect-gemini-2-5-series-models/102386)

**thinking_budget for Flash Lite:** Flash Lite defaults to thinking disabled (budget = 0). To enable: set `thinkingBudget` between 512 and 24,576 in `ThinkingConfig`. Setting to 0 explicitly disables it. Known instability: some preview versions of 2.5 Flash ignored `thinking_budget=0` and still ran thinking tokens. As of stable releases this appears resolved.

Source: [Gemini thinking docs](https://ai.google.dev/gemini-api/docs/thinking)

**maxOutputTokens:** Not discussed in the context of Flash Lite specifically in official docs. The model's hard output limit is 65,536 tokens. The current setting of 1,536 is appropriate for a chat application with 1–3 sentence expected replies — it is tight enough to prevent runaway long outputs but leaves room for grounded answers with citations.

**response_mime_type + tools conflict:** There is a confirmed bug on 2.5 models (both Flash and Flash Lite) where setting `response_mime_type: 'application/json'` combined with `tools` causes a conflict — the model may enter a tool call loop or produce malformed output. The workaround is a two-stage approach: first run with tools only (no schema), then run with schema only (no tools).

Source: [Developer forum — Flash stuck in tool call loop with tools + structured output](https://discuss.ai.google.dev/t/gemini-2-5-flash-stuck-in-a-tool-call-loop-when-using-both-tools-and-structured-output/110777)

### What the current code does

- `temperature: 0.8` — set in `stream-personal.ts` line 148.
- `maxOutputTokens: 1536` — line 146.
- No `topP`, no `topK`, no `thinkingConfig`, no `response_mime_type`.
- Single config for all modes (greeting, conversation, grounded/tool). Temperature does not vary by mode.

### Recommendation

**Three concrete changes:**

**1. Lower temperature to 0.7 for all turns, or split by mode.**
At 0.8 on Flash Lite, the model has more headroom to diverge from the system instruction on edge cases. The dark humor persona requires precise register, not creative randomness — lower temperature improves instruction adherence without flattening the voice. The 0.1 difference matters more on Flash Lite (weaker model) than it would on Flash. If upgrading to Flash, 0.8 is reasonable. On Flash Lite specifically, 0.7 is safer.

If splitting: use 0.6 for `grounded` mode (tool-arg accuracy matters more than voice creativity) and 0.8 for `conversation` mode (voice/humor latitude is earned here). Keep `greeting` at 0.7.

**2. Explicitly set thinkingBudget for tool-use turns on Flash (if upgrading).**
If moving to `gemini-2.5-flash`, enable a low thinking budget (512–1024 tokens) specifically for `grounded` mode turns. Flash's thinking capability measurably improves function argument generation. For `conversation` and `greeting` turns, keep `thinkingBudget: 0` to avoid latency cost. Flash Lite's thinking is less useful for this workload — the reasoning gap vs Flash is too large to be bridged by a budget increment.

**3. Do NOT add response_mime_type with tools.**
The team should not attempt to use `responseSchema` or `response_mime_type: 'application/json'` on the same call that has tools attached. This is a documented 2.5-series conflict. The current code correctly avoids this. Do not add it.

**Apply at:** `/Users/mina/Documents/Mina/Wiscord/backend/src/modules/ai/provider/stream-personal.ts` — the `config` block at lines 143–151. Add mode parameter to `StreamArgs` interface (line 113), pass `ctx.mode` from `service.ts`, and branch temperature and thinkingConfig by mode.

---

## Q4 — Tool-use reliability on Flash Lite

### What the docs say

**functionCallingConfig modes:**

| Mode | Behavior |
|---|---|
| AUTO | Default when only function declarations are present. Model decides whether to call a function or reply with text. |
| VALIDATED | Default when multiple tool types are combined. Model predicts either function calls or text; enforces schema adherence. |
| ANY | Forces the model to always predict a function call. Ensures schema compliance. |
| NONE | Prohibits function calling. |

Source: [Gemini function calling docs](https://ai.google.dev/gemini-api/docs/function-calling)

**Setting toolConfig:**
```javascript
const toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingConfigMode.AUTO, // or ANY, NONE, VALIDATED
    allowedFunctionNames: ['createCalendarEvent'] // optional restriction
  }
};
```
Pass this as `config.toolConfig` alongside `config.tools`.

**Multi-turn function call history format:** The official docs confirm the correct pattern:
1. Model response with `functionCall` part → append as `{role: 'model', parts: [{functionCall: {id, name, args}}]}`
2. Function result → append as `{role: 'user', parts: [{functionResponse: {id, name, response: {...}}}]}`
3. For 2.5 models: always pass the matching `id` from the function call in the response to enable accurate mapping.

Source: [Gemini function calling multi-turn docs](https://ai.google.dev/gemini-api/docs/function-calling)

**thought_signature for 2.5 thinking models:** When using 2.5 Flash (non-Lite) with thinking enabled and manually managing conversation history, the SDK's `thought_signature` must be included in the model turn exactly as received. The `@google/genai` SDK handles this automatically when using the built-in chat history management — only relevant when constructing `Contents[]` manually (which Wiscord's service.ts does).

Source: [Gemini function calling docs — thought_signature section](https://ai.google.dev/gemini-api/docs/function-calling)

**Flash Lite structured output / tool arg reliability:** A confirmed bug (late 2025) caused Flash Lite to wrap structured JSON output in markdown code fences (` ```json ``` `). This was resolved by December 2025. However, a separate confirmed issue shows that Flash Lite (and Flash 2.5 generally) can produce tool args with inconsistent formatting — the ISO datetime bug (`2026-05-17 18:00` without `T`) is consistent with Flash Lite's documented weaker structured-output reliability compared to Flash.

Source: [Flash Lite structured output bug](https://discuss.ai.google.dev/t/gemini-2-5-flash-lite-produces-incorrect-structured-output/102367)

**Tool call loop issue (Flash + Flash Lite):** Confirmed issue where the model loops on the same tool call endlessly when `response_mime_type` or `responseSchema` is combined with `tools`. Current Wiscord code does NOT use `responseSchema`, so this is not triggered. Relevant if the team considers adding structured output to the AI response.

Source: [Tool call loop bug report](https://discuss.ai.google.dev/t/gemini-2-5-flash-stuck-in-a-tool-call-loop-when-using-both-tools-and-structured-output/110777)

### What the current code does

- `CALENDAR_TOOLS` passed as `config.tools` — correct.
- No `toolConfig.functionCallingConfig` is set — mode defaults to `AUTO`.
- `startAt` and `endAt` field descriptions in the function declaration (lines 25, 54, 57) already warn against space-separated format and naive datetimes. This is well-written.
- `tool-runner.ts` line 34: `STRICT_DATETIME_RE` is used in Zod validation, and `normalizeLocalIso` is called server-side to fix naive datetimes when they slip through — line 160–162. This is a correct defensive layer.
- Multi-turn function call history is correctly assembled in `service.ts` `turnToContents()` (lines 300–334), with `functionCall` in `{role: 'model'}` and `functionResponse` in `{role: 'user'}`.
- The code does not pass `id` in `functionResponse` parts (line 325 — `functionResponse: { name: c.name, response: ... }` has no `id` field). This matters for 2.5 models.

### Recommendation

**Three concrete changes:**

**1. Add `id` to `functionResponse` parts in multi-turn history.**
The official docs state that for Gemini 2.5 models, passing the matching `id` from the function call in the `functionResponse` is required for accurate mapping. The current `turnToContents()` in `service.ts` does not thread the call ID through. The stored `toolCalls` array needs to preserve the model's `functionCall.id` (from the chunk), and `turnToContents` needs to pass it in `functionResponse`.

This requires:
- Capturing `call.id` from `chunk.functionCalls` in `stream-personal.ts` (line 185 area) alongside `call.name` and `call.args`.
- Storing it in the `toolCallsForTurn` entries in `service.ts`.
- Persisting it in `AiConversationMessage` tool call records.
- Including it in `turnToContents()` `functionResponse` part.

**Apply at:** `stream-personal.ts` line 183–188 (capture `call.id`), `service.ts` lines 171–178 (store `callId` as model's id, not generated UUID), `service.ts` lines 319–331 (`turnToContents` — pass `id` in `functionResponse`).

**2. Set explicit `toolConfig.functionCallingConfig.mode: 'AUTO'`.**
The current code relies on the default (`AUTO`). Making it explicit has two benefits: (a) it documents intent; (b) it guards against future SDK version changes to the default. Mode `AUTO` is correct for this workload — the model needs to decide per turn whether to call a tool or just chat. Do NOT use `ANY` — that would force a tool call on every turn including pure vent threads.

**Apply at:** `stream-personal.ts` lines 143–151 — add `toolConfig: { functionCallingConfig: { mode: 'AUTO' } }` to the `config` block.

**3. Upgrade to Flash non-Lite for tool turns.**
Flash Lite's weaker structured-output reliability (demonstrated by the ISO datetime issue and the confirmed structured-output bugs) is a systemic problem for tool-arg generation. Flash non-Lite's higher GPQA score correlates with better instruction adherence on constrained-format outputs. If using the hybrid routing approach from Q1, all `grounded` mode calls (which are the only ones that can trigger tool calls) should go to Flash.

---

## Q5 — Multi-turn `contents` array best practices

### What the docs say

**Role alternation requirement:** The Gemini API requires the `contents` array to alternate between `{role: 'user'}` and `{role: 'model'}` turns. Consecutive turns of the same role are a protocol error.

Source: [Gemini multi-turn docs](https://discuss.ai.google.dev/t/multi-turn-and-conversation-history/66545) and [Gemini API reference](https://ai.google.dev/api/generate-content)

**thought_signature in 2.5 multi-turn:** When using 2.5 thinking models (Flash or Flash Lite with thinking enabled) and manually managing `Contents[]`, the `thought_signature` field that arrives on model turn parts must be sent back verbatim in subsequent requests. The SDK handles this automatically; manual array construction must preserve it. Failure to do so causes the model to lose reasoning continuity across turns.

Source: [Gemini function calling docs — thought_signature](https://ai.google.dev/gemini-api/docs/function-calling)

**Mixing structured and bare user turns:** The official docs do not explicitly address the failure mode of mixing structured user turns (`=== NOW === / ...` scaffold) with bare text prior turns in the same `contents` array. However, the general guidance that models "respond best to prompts that are direct, well-structured, and clearly define the task" — and the well-documented Lost-in-the-Middle phenomenon (where information in the middle of long contexts is underweighted) — both support the team's existing intuition about shape parity between current and historical user turns.

The key insight the team has already implemented (bare-text user turns for conversation/greeting mode) is the correct mitigation. The docs support keeping consistent formatting across the `contents` array.

**Continuation vs fresh query disambiguation:** No official Google documentation directly addresses this. The team's existing `AiMode` routing (greeting → 0 history, conversation → 6 turns bare, grounded → 11 turns with scaffold) is the right architectural pattern. The issue is that Flash Lite's weaker reasoning makes it less reliable at inferring conversational thread from the available context.

### What the current code does

- `service.ts` lines 143–168: Mode-based history window (0 / 6 / 11 turns) is correct.
- `turnToContents()` for user turns: returns `[{role: 'user', parts: [{text: turn.text}]}]` — bare text, correct shape parity.
- `turnToContents()` for assistant turns with resolved tool calls: emits three Content entries (model→functionCall, user→functionResponse, model→text) — correct alternation.
- The current user turn is appended as bare text for conversation/greeting, or as the full `=== NOW === ...` scaffold for grounded — shape parity is maintained between historical and current user turns within each mode. This is the right approach.
- **Known gap:** `thought_signature` is not captured or replayed. If the team enables thinking on Flash (via `thinkingConfig.thinkingBudget > 0`), the SDK's automatic handling of `thought_signature` may not apply when manually constructing `Contents[]`. This needs verification against `@google/genai` v1.52 specifically.

### Recommendation

**Three concrete changes:**

**1. Verify `thought_signature` handling in `@google/genai` v1.52 before enabling thinking.**
If the team upgrades to Flash and enables `thinkingBudget > 0`, test whether the SDK transparently handles `thought_signature` propagation across manual `Contents[]` construction, or whether `turnToContents()` needs to capture and replay it. The official docs say the SDK handles this automatically; confirm by inspecting raw chunk parts for `thought_signature` presence in `stream-personal.ts` lines 166–204.

**2. Do not introduce structured `=== CONTEXT ===` sections into conversation-mode history turns.**
If any future logging, debugging, or context enrichment injects scaffolded text into historical user turns (e.g., prepending a timestamp or metadata to stored turn text before persisting), it will break the shape parity that makes elliptical follow-ups work. The `appendTurn` call in `service.ts` line 103–108 stores `args.question` raw — keep it that way.

**3. Consider limiting history to resolved turns only.**
Currently, `expireStalePendingToolCalls` is called before reading history (service.ts lines 155–166), which converts stale pending calls to `declined` before `turnToContents` runs. This is correct. An additional guard: if any turn in the last 6 has `status: 'pending_confirmation'` (a user who received a confirmation dialog but hasn't responded yet), its `functionCall` part would appear in the model's view without a matching `functionResponse` in the same call — this is the exact broken-protocol state. The current code filters to `executed | failed | declined` in `turnToContents()` line 304, which drops the unpaired call correctly. Verify this remains true when the pending call is the most recent turn — the model's last output would be blank if the tool call is omitted, which could confuse the next turn's context.

---

## Summary of All Findings

### Should we upgrade the model?

Yes — upgrade `greeting` and `conversation` mode to `gemini-2.5-flash` immediately. Flash non-Lite is Google's recommended model for "responsive chat applications." Flash Lite is positioned for classification and simple extraction, not nuanced multi-turn persona chat. The output cost difference is negligible at 1–3 sentence reply lengths. Keep Flash Lite only if you implement mode-based routing where greeting/conversation go to Lite and grounded/tool calls go to Flash.

### Most impactful prompt-design change

Move the `VOICE_ANCHORS` few-shot examples from inside `systemInstruction` into the `contents` array as prepended `{role:'user'}/{role:'model'}` prefill turns. This directly addresses the verbatim-copying failure: system instruction anchors are the closest structural thing to a memorized lookup table. Moving them to prefill turns represents them correctly as "past conversation examples" and reduces overfitting on structurally similar current messages.

### Most impactful generation-config change

Explicitly set `thinkingConfig.thinkingBudget` by mode when running Flash non-Lite: 0 for greeting/conversation (latency-sensitive, voice not reasoning), 1024 for grounded/tool turns (structured arg generation benefits from thinking). On Flash Lite as currently deployed: lower temperature to 0.7 (from 0.8) to improve instruction adherence on the constrained-register persona.

### Most impactful tool-use change

Add `id` to `functionResponse` parts in `turnToContents()`. The official Gemini 2.5 docs require the function call's `id` to be echoed in the response for accurate multi-turn tool mapping. The current code generates a local UUID (`inline-${randomUUID()}`) rather than capturing the model's own `id` from the function call chunk. This is a protocol gap that can cause tool-use state drift on follow-up turns ("another one at 2pm" scenarios).

### "You're doing this completely wrong" surprises

**One critical surprise:** The `functionResponse` parts in multi-turn history do not carry the model's original `functionCall.id`. On Gemini 2.5 models, the docs explicitly state this ID is required for accurate mapping. This is not an aesthetic issue — on Gemini 3 (which the team will eventually target) this becomes a hard protocol error. Fix it now before the model is upgraded.

**One structural surprise:** The team's mode-based history routing (`greeting` → 0 history, `conversation` → 6 turns, `grounded` → 11 turns) combined with bare vs. scaffolded user turn shape is architecturally correct and more sophisticated than typical implementations. The main remaining issue is not the architecture — it is the model capability tier. Most of the symptoms (elliptical follow-up amnesia, therapy-mode reflexes, scaffold sensitivity) are Flash Lite reliability problems that will improve on Flash without any other changes.

---

## Primary Sources Referenced

- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Gemini Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Gemini Thinking](https://ai.google.dev/gemini-api/docs/thinking)
- [Gemini Text Generation / GenerationConfig](https://ai.google.dev/gemini-api/docs/text-generation)
- [Google Cloud Flash Lite Model Page](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite)
- [Google Cloud Blog — Flash/Pro GA](https://cloud.google.com/blog/products/ai-machine-learning/gemini-2-5-flash-lite-flash-pro-ga-vertex-ai)
- [llm-stats Flash vs Flash Lite benchmarks](https://llm-stats.com/models/compare/gemini-2.5-flash-vs-gemini-2.5-flash-lite)
- [Flash Lite structured output bug (developer forum)](https://discuss.ai.google.dev/t/gemini-2-5-flash-lite-produces-incorrect-structured-output/102367)
- [Flash tool call loop with structured output (developer forum)](https://discuss.ai.google.dev/t/gemini-2-5-flash-stuck-in-a-tool-call-loop-when-using-both-tools-and-structured-output/110777)
- [Flash quality degradation (developer forum)](https://discuss.ai.google.dev/t/gemini-2-5-flash-quality-degradation-based-on-internal-evals/94561)
- [topK on 2.5 models (developer forum)](https://discuss.ai.google.dev/t/does-the-top-k-parameter-affect-gemini-2-5-series-models/102386)
- [Few-shot best practices (developer forum)](https://discuss.ai.google.dev/t/few-shot-best-practices-and-experiences/41521)
- [Google Cloud — Include few-shot examples](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/few-shot-examples)
