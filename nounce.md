Verdict: your instinct is correct. What we did (client generates the actual database primary key _id and forces Mongo to use it) is a real pattern, but it
  is not what Discord/Slack/Messenger do, and it has concrete downsides:

  1. Discord keeps ids server-authoritative. Their message ids are snowflakes (timestamp + worker + sequence, globally sortable), generated server-side.
  Letting a client choose the primary key is something they'd never allow — it's a trust/integrity concern (a client can pick arbitrary, colliding, or
  non-time-ordered ids).
  2. It quietly breaks an ordering assumption. getMessages sorts by { createdAt: -1, _id: -1 } — the _id tiebreaker assumes ids are monotonic with time.
  Random client ids break that for same-millisecond messages.
  3. The collision fallback re-introduces the bug. When _id collides, the server silently uses a different id — so the client's optimistic key no longer
  matches, and the exact remount/animation bug comes back (rare, but it's a landmine).

  What real chat apps actually do: the nonce (transaction-id) pattern. The server keeps its own authoritative id; the client attaches a throwaway nonce to
  the send; the server echoes that nonce back on the created message; the client matches optimistic→confirmed by nonce and keys the list by nonce ?? id.
  Discord literally has a nonce field on its message object for exactly this. Let me get the planning tool and lay out the change.