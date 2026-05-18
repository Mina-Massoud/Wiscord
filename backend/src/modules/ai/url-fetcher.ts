import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

import { logger } from '../../lib/logger.js';

/**
 * URL fetching + article extraction for the personal AI scope.
 *
 * When the user drops a link in their question ("explain this:
 * https://…"), we fetch the page, run it through Mozilla's
 * Readability extractor (the same library Firefox Reader Mode uses),
 * and surface the cleaned plaintext as a new data block to Gemini.
 * The model then writes a long-form genz note grounded in real
 * source material instead of hallucinating from training-data prior.
 *
 * Hard constraints:
 *   - Only http/https URLs. file://, data:, javascript: rejected.
 *   - SSRF protection: DNS-resolve and reject loopback / private /
 *     link-local addresses before issuing the request.
 *   - 8s total fetch timeout, 5MB response cap.
 *   - 24k char cap on extracted content per doc (Gemini context budget).
 *   - Max 3 URLs per turn — anything beyond is dropped.
 *   - All errors are caught and surfaced as `{ ok: false, error }`
 *     so a flaky URL never crashes the whole stream.
 */

export const URL_FETCHER_LIMITS = {
  /** Max URLs we'll fetch per AI turn. Anything beyond is dropped. */
  maxUrlsPerTurn: 3,
  /** Total time budget for a single fetch (ms). */
  fetchTimeoutMs: 8_000,
  /** Cap on response body size (bytes). 5MB is enough for any real
   *  article — past that we're almost certainly looking at a bug or
   *  a tarball someone linked by mistake. */
  maxResponseBytes: 5 * 1024 * 1024,
  /** Cap on cleaned article text per source (~3k tokens). Was 24k
   *  but that pushed prompts past 11k tokens and Gemini Flash started
   *  emitting MALFORMED_FUNCTION_CALL when asked to round-trip the
   *  content into a long JSON-escaped createNote tool body. 12k is
   *  enough for the model to write a 1500–3000 word summary while
   *  keeping the round-trip JSON manageable. */
  maxContentChars: 12_000,
} as const;

const USER_AGENT = 'Wiscord-AI/1.0 (+https://wiscord.app)';

/**
 * Result of `fetchAndExtract`. Always returned (never thrown) so the
 * caller can render a partial answer when one URL of three fails.
 */
export type FetchedDoc =
  | {
      ok: true;
      url: string;
      title: string;
      siteName: string | null;
      byline: string | null;
      content: string;
      truncated: boolean;
    }
  | {
      ok: false;
      url: string;
      error: string;
    };

/**
 * Pull URLs out of a freeform user message. Matches both:
 *   - Explicit `https://wiscord.app/foo` style
 *   - Bare domains the user typed without a scheme: `mina-massoud.com`,
 *     `claude.ai/code`, `www.example.org`
 *
 * Bare domains are only promoted when their TLD is in `KNOWN_TLDS` —
 * keeps `app.tsx`, `next.js`, `script.py` and other code references
 * from being mistaken for sites. Each promoted bare domain gets
 * `https://` prefixed so downstream code only ever deals in full URLs.
 *
 * Caller decides what to do with the list — we just surface it. Cap
 * at `maxUrlsPerTurn` so a comment thread with 50 links can't fan
 * out into 50 parallel fetches.
 */
export function extractUrls(question: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Tokenize on whitespace + commas. URLs never contain unescaped
  // spaces so this is a safe split. Surrounding punctuation
  // (`(`, `)`, `.`, `,`, `"`) gets stripped per token before parsing.
  for (const raw of question.split(/[\s,]+/)) {
    const token = stripSurroundingPunctuation(raw);
    if (token.length === 0) continue;
    const normalized = normalizeToUrl(token);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= URL_FETCHER_LIMITS.maxUrlsPerTurn) break;
  }
  return out;
}

function stripSurroundingPunctuation(s: string): string {
  return s.replace(/^[(\[{<"'`]+/, '').replace(/[.,;:!?)\]}>"'`]+$/, '');
}

/**
 * Either accept an explicit http(s) URL as-is, or promote a bare
 * domain to `https://` when the TLD looks plausibly real. Returns
 * `null` for anything that doesn't look like a fetchable URL.
 */
function normalizeToUrl(token: string): string | null {
  if (/^https?:\/\//i.test(token)) {
    return isValidHttpUrl(token) ? token : null;
  }
  // Bare domain pattern: optional `www.`, one or more `host.` segments,
  // a final TLD-looking segment, optional path. Anchored both ends so
  // we don't match substrings inside larger junk.
  const match = token.match(
    /^(?:www\.)?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*)\.([a-z]{2,24})(\/[^\s]*)?$/i,
  );
  if (!match) return null;
  const tld = match[2]?.toLowerCase();
  if (!tld || !KNOWN_TLDS.has(tld)) return null;
  return `https://${token}`;
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Conservative TLD whitelist for promoting bare domains. Optimized
 * for "user might reasonably drop this in chat as a website":
 *   - the heavy gTLDs (com/org/net/info/biz)
 *   - modern app/dev TLDs (io/ai/app/dev/co/me/so/xyz/tech/cloud/page/site)
 *   - common ccTLDs people actually publish at
 *
 * NOT included: `.js`, `.ts`, `.py`, `.go`, `.rs`, `.sh`, `.css`, `.md`,
 * `.txt`, `.json` — all real ccTLDs technically, but the false-positive
 * rate against code references is brutal. Users typing those as
 * actual sites should include the `https://` prefix.
 */
const KNOWN_TLDS = new Set<string>([
  // gTLD heavyweights
  'com', 'org', 'net', 'info', 'biz', 'pro', 'name',
  // modern tech/app/creator TLDs
  'io', 'ai', 'app', 'dev', 'co', 'me', 'so', 'xyz', 'tech', 'cloud',
  'page', 'site', 'online', 'store', 'shop', 'design', 'studio', 'works',
  'news', 'blog', 'media', 'press', 'wiki', 'review',
  // social / short-link
  'gg', 'fm', 'tv', 'ly', 'to', 'cc', 'is',
  // generic
  'edu', 'gov', 'mil', 'int',
  // common ccTLDs people publish at (no `.us` shorthand collisions
  // worth worrying about in practice)
  'uk', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at', 'se', 'no',
  'dk', 'fi', 'pl', 'cz', 'ie', 'pt', 'gr', 'ro', 'hu',
  'jp', 'kr', 'cn', 'hk', 'tw', 'sg', 'my', 'th', 'vn', 'id', 'in',
  'au', 'nz',
  'us', 'ca', 'mx', 'br', 'ar', 'cl',
  'ru', 'ua', 'tr', 'il', 'ae', 'sa', 'eg', 'za', 'ng', 'ke',
]);

/**
 * Block RFC1918 / loopback / link-local / multicast addresses. Without
 * this, a user could share `http://169.254.169.254/latest/meta-data`
 * (EC2 metadata) or `http://127.0.0.1:6379` (local Redis) and trick
 * the server into proxying internal traffic.
 *
 * We resolve the hostname ourselves and check the result BEFORE
 * issuing the fetch — `fetch()` resolves DNS again internally, so
 * there's a theoretical TOCTOU window where the record flips between
 * checks. For our threat model (lazy URL summarization, not a
 * hardened proxy) the simple check is enough. Defense-in-depth for
 * production would mean a custom http.Agent that pins the resolved IP.
 */
async function assertPublicHost(host: string): Promise<void> {
  // Literal IPs — check directly.
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) {
      throw new Error(`refusing to fetch private/internal address: ${host}`);
    }
    return;
  }
  // Hostnames — resolve and check every address. `all: true` returns
  // both A and AAAA records so we don't miss an IPv6 leak.
  let records: { address: string; family: number }[];
  try {
    records = await lookup(host, { all: true });
  } catch (err) {
    throw new Error(`dns lookup failed for ${host}: ${err instanceof Error ? err.message : 'unknown'}`);
  }
  for (const r of records) {
    if (isPrivateAddress(r.address)) {
      throw new Error(`refusing to fetch host ${host} (resolves to private address ${r.address})`);
    }
  }
}

/**
 * Match the blocklisted ranges from RFC1918, RFC5735, RFC4193, and
 * friends. We keep this intentionally permissive about input format
 * (literal IPs only — caller handles hostname resolution) and reject
 * anything that smells internal.
 */
function isPrivateAddress(ip: string): boolean {
  if (ip === '0.0.0.0' || ip === '::' || ip === '::1') return true;
  // IPv4-mapped IPv6 ("::ffff:192.168.0.1") — strip the prefix and
  // re-check the embedded v4 address.
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped && v4Mapped[1]) return isPrivateAddress(v4Mapped[1]);
  if (ip.includes(':')) {
    // IPv6 ranges we treat as private:
    //   fc00::/7  — unique local addresses
    //   fe80::/10 — link-local
    //   ff00::/8  — multicast
    const lower = ip.toLowerCase();
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
    if (lower.startsWith('ff')) return true;
    return false;
  }
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  // After the length+range guard above, every slot is a real number.
  const a = parts[0] as number;
  const b = parts[1] as number;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. EC2 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * Fetch a single URL, extract the article body with Readability, and
 * return a cleaned summary. Always resolves (never rejects) — errors
 * land as `{ ok: false, error }` so the caller can keep streaming
 * partial results when one URL of several misbehaves.
 */
export async function fetchAndExtract(rawUrl: string): Promise<FetchedDoc> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, url: rawUrl, error: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, url: rawUrl, error: 'unsupported_protocol' };
  }
  try {
    await assertPublicHost(url.hostname);
  } catch (err) {
    return { ok: false, url: rawUrl, error: err instanceof Error ? err.message : 'ssrf_blocked' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_FETCHER_LIMITS.fetchTimeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.7',
      },
    });
    if (!res.ok) {
      return { ok: false, url: rawUrl, error: `http_${res.status}` };
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { ok: false, url: rawUrl, error: `unsupported_content_type:${contentType.split(';')[0] || 'unknown'}` };
    }
    // After redirects the resolved URL may point at a different host
    // — re-check the destination so an http://allowed-host that
    // 302s to http://169.254.169.254 still gets blocked. `res.url`
    // is empty on manually-constructed Response objects (tests),
    // so fall back to the request URL when it's missing.
    const finalUrlStr = res.url && res.url.length > 0 ? res.url : url.toString();
    let finalUrl: URL;
    try {
      finalUrl = new URL(finalUrlStr);
    } catch {
      finalUrl = url;
    }
    try {
      await assertPublicHost(finalUrl.hostname);
    } catch (err) {
      return {
        ok: false,
        url: rawUrl,
        error: `redirected_to_private: ${err instanceof Error ? err.message : 'blocked'}`,
      };
    }
    // Stream-cap the body so a 500MB tarball can't OOM the box.
    const html = await readCappedText(res, URL_FETCHER_LIMITS.maxResponseBytes);
    return extractFromHtml(rawUrl, finalUrl.toString(), html);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch_failed';
    const isAbort = err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message));
    return { ok: false, url: rawUrl, error: isAbort ? 'fetch_timeout' : message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Drain the response body up to `maxBytes`, then throw away the rest.
 * `Response.text()` happily loads a gigabyte into memory; we use the
 * reader directly so we can bail early.
 */
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // Stop reading, release the lock, return what we have. Better
      // a partial article than an OOM.
      try {
        await reader.cancel();
      } catch {
        /* best-effort */
      }
      logger.warn({ totalBytes: total, maxBytes }, 'url-fetcher: response exceeded cap, truncating');
      break;
    }
    chunks.push(value);
  }
  // Concatenate + decode. `TextDecoder` handles malformed sequences
  // gracefully (default fatal=false), so a truncated UTF-8 codepoint
  // at the cut point won't blow up.
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8').decode(buf);
}

/**
 * Run Readability on a raw HTML string and return a cleaned doc.
 * Split out from `fetchAndExtract` so tests can exercise the parsing
 * layer without a live HTTP server.
 */
export function extractFromHtml(originalUrl: string, finalUrl: string, html: string): FetchedDoc {
  try {
    // `JSDOM` needs a URL so relative links and `<base>` tags resolve
    // correctly. We hand it the final (post-redirect) URL.
    const dom = new JSDOM(html, { url: finalUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent) {
      return { ok: false, url: originalUrl, error: 'no_article_content' };
    }
    const rawContent = article.textContent.trim();
    if (rawContent.length === 0) {
      return { ok: false, url: originalUrl, error: 'empty_article' };
    }
    const truncated = rawContent.length > URL_FETCHER_LIMITS.maxContentChars;
    const content = truncated ? rawContent.slice(0, URL_FETCHER_LIMITS.maxContentChars) : rawContent;
    return {
      ok: true,
      url: originalUrl,
      title: (article.title ?? '').trim() || hostnameFallback(finalUrl),
      siteName: (article.siteName ?? '').trim() || null,
      byline: (article.byline ?? '').trim() || null,
      content,
      truncated,
    };
  } catch (err) {
    return {
      ok: false,
      url: originalUrl,
      error: err instanceof Error ? `parse_failed: ${err.message}` : 'parse_failed',
    };
  }
}

function hostnameFallback(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'untitled';
  }
}

/**
 * Convenience: fetch every URL in parallel with `Promise.allSettled`
 * so one slow / failing URL doesn't block the rest. Returns results
 * in input order. Caller renders successes + failures into the
 * WEB SOURCES prompt block.
 */
export async function fetchAll(urls: string[]): Promise<FetchedDoc[]> {
  if (urls.length === 0) return [];
  const settled = await Promise.allSettled(urls.map((u) => fetchAndExtract(u)));
  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const url = urls[i] ?? 'unknown';
    return { ok: false, url, error: s.reason instanceof Error ? s.reason.message : 'unknown' };
  });
}
