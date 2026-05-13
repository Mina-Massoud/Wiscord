// Editor-only ambient declarations for Supabase Edge Functions.
//
// These functions run on Deno. At deploy time, Deno's type-checker resolves
// `npm:` specifiers from `deno.json` and types the Deno global natively.
// This file just satisfies non-Deno TypeScript LSPs (the default in VS Code
// without the Deno extension) so editors stop flagging valid Edge Function
// code as errors.
//
// Types are intentionally loose — the real type contract is the runtime
// behavior validated by Deno at deploy. If you want fully typed access to
// your Supabase tables, run `supabase gen types typescript` and import the
// generated types in your function code.

// ─── Deno global ───────────────────────────────────────────────
declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;

  export function serve(
    options: { port?: number; hostname?: string },
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

// ─── @supabase/supabase-js ─────────────────────────────────────
declare module "@supabase/supabase-js" {
  export interface PostgrestError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  }

  export interface QueryResult<T> {
    data: T | null;
    error: PostgrestError | null;
  }

  export interface QueryArrayResult<T> {
    data: T[] | null;
    error: PostgrestError | null;
  }

  export interface QueryBuilder<Row = unknown> extends PromiseLike<
    QueryArrayResult<Row>
  > {
    select(columns?: string): QueryBuilder<Row>;
    eq(column: string, value: unknown): QueryBuilder<Row>;
    neq(column: string, value: unknown): QueryBuilder<Row>;
    gt(column: string, value: unknown): QueryBuilder<Row>;
    lt(column: string, value: unknown): QueryBuilder<Row>;
    gte(column: string, value: unknown): QueryBuilder<Row>;
    lte(column: string, value: unknown): QueryBuilder<Row>;
    in(column: string, values: unknown[]): QueryBuilder<Row>;
    order(column: string, options?: { ascending?: boolean }): QueryBuilder<Row>;
    limit(count: number): QueryBuilder<Row>;
    returns<T>(): QueryBuilder<T>;
    single<T = Row>(): Promise<QueryResult<T>>;
    maybeSingle<T = Row>(): Promise<QueryResult<T>>;
    insert(values: unknown): QueryBuilder<Row>;
    update(values: unknown): QueryBuilder<Row>;
    delete(): QueryBuilder<Row>;
  }

  export interface AuthUser {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }

  export interface SupabaseClient {
    from(table: string): QueryBuilder;
    rpc(
      fn: string,
      args?: Record<string, unknown>,
    ): Promise<QueryResult<unknown>>;
    auth: {
      getUser(): Promise<{
        data: { user: AuthUser | null };
        error: PostgrestError | null;
      }>;
    };
  }

  export function createClient(
    url: string,
    key: string,
    options?: {
      global?: { headers?: Record<string, string> };
      auth?: { persistSession?: boolean; autoRefreshToken?: boolean };
    },
  ): SupabaseClient;
}

// ─── @anthropic-ai/sdk ─────────────────────────────────────────
declare module "@anthropic-ai/sdk" {
  export interface TextDelta {
    type: "text_delta";
    text: string;
  }

  export interface ContentBlockDeltaEvent {
    type: "content_block_delta";
    index: number;
    delta: TextDelta;
  }

  export interface OtherStreamEvent {
    type:
      | "message_start"
      | "content_block_start"
      | "content_block_stop"
      | "message_delta"
      | "message_stop"
      | "ping";
    [key: string]: unknown;
  }

  export type MessageStreamEvent = ContentBlockDeltaEvent | OtherStreamEvent;

  export interface Usage {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  }

  export interface FinalMessage {
    usage: Usage;
    content: Array<{ type: string; text?: string }>;
    stop_reason: string | null;
  }

  export interface MessageStream extends AsyncIterable<MessageStreamEvent> {
    finalMessage(): Promise<FinalMessage>;
  }

  export interface SystemBlock {
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }

  export interface MessagesStreamParams {
    model: string;
    max_tokens: number;
    system?: string | SystemBlock[];
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
    top_p?: number;
  }

  export default class Anthropic {
    constructor(options: { apiKey: string });
    messages: {
      stream(params: MessagesStreamParams): MessageStream;
    };
  }
}

// ─── livekit-server-sdk ────────────────────────────────────────
declare module "livekit-server-sdk" {
  export interface AccessTokenOptions {
    identity: string;
    name?: string;
    ttl?: string | number;
  }

  export interface VideoGrant {
    roomJoin?: boolean;
    room?: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    canUpdateOwnMetadata?: boolean;
    hidden?: boolean;
    recorder?: boolean;
  }

  export class AccessToken {
    constructor(apiKey: string, apiSecret: string, options: AccessTokenOptions);
    addGrant(grant: VideoGrant): void;
    toJwt(): Promise<string>;
  }
}
