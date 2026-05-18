import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  extractFromHtml,
  extractUrls,
  fetchAll,
  fetchAndExtract,
  URL_FETCHER_LIMITS,
} from '../../src/modules/ai/url-fetcher.js';

describe('extractUrls', () => {
  test('pulls a single http(s) url out of a sentence', () => {
    expect(extractUrls('check this https://example.com/article')).toEqual([
      'https://example.com/article',
    ]);
  });

  test('strips trailing punctuation users tend to type', () => {
    expect(extractUrls('see https://example.com/x.')).toEqual(['https://example.com/x']);
    expect(extractUrls('(see https://example.com/y).')).toEqual(['https://example.com/y']);
    expect(extractUrls('check https://example.com/z, then go')).toEqual([
      'https://example.com/z',
    ]);
  });

  test('dedupes identical URLs while preserving first-occurrence order', () => {
    const urls = extractUrls(
      'first: https://example.com/a then https://example.com/b then https://example.com/a again',
    );
    expect(urls).toEqual(['https://example.com/a', 'https://example.com/b']);
  });

  test('caps at maxUrlsPerTurn', () => {
    const many = Array.from({ length: 10 }, (_, i) => `https://example.com/p${i}`).join(' ');
    expect(extractUrls(many)).toHaveLength(URL_FETCHER_LIMITS.maxUrlsPerTurn);
  });

  test('ignores non-http schemes', () => {
    expect(
      extractUrls('grab file:///etc/passwd or javascript:alert(1) or ftp://x.com/y'),
    ).toEqual([]);
  });

  test('returns empty array when no urls present', () => {
    expect(extractUrls('just a normal sentence')).toEqual([]);
    expect(extractUrls('')).toEqual([]);
  });

  test('promotes bare domains with known TLDs to https://', () => {
    expect(extractUrls('check out mina-massoud.com')).toEqual(['https://mina-massoud.com']);
    expect(extractUrls('see claude.ai for the docs')).toEqual(['https://claude.ai']);
    expect(extractUrls('wiscord.app/labs is the spot')).toEqual(['https://wiscord.app/labs']);
  });

  test('handles www. prefixed bare domains', () => {
    expect(extractUrls('go to www.example.org')).toEqual(['https://www.example.org']);
  });

  test('does NOT promote code references that look like domains', () => {
    // File extensions that double as ccTLDs but are almost always code.
    expect(extractUrls('open App.tsx')).toEqual([]);
    expect(extractUrls('check next.js and node.js')).toEqual([]);
    expect(extractUrls('run script.py then main.go')).toEqual([]);
    expect(extractUrls('see README.md and styles.css')).toEqual([]);
  });

  test('the bug from the original report — "about the mina-massoud.com site"', () => {
    // Regression: this exact phrasing returned [] before the fix.
    const result = extractUrls(
      'Now give me note about the mina-massoud.com site, the note should explain it',
    );
    expect(result).toEqual(['https://mina-massoud.com']);
  });

  test('mixed explicit + bare in one message', () => {
    const result = extractUrls('compare https://wiscord.app with discord.com');
    expect(result).toEqual(['https://wiscord.app', 'https://discord.com']);
  });
});

describe('fetchAndExtract — input validation + SSRF', () => {
  test('rejects malformed URL', async () => {
    const result = await fetchAndExtract('not-a-url');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid_url|unsupported/);
  });

  test('rejects non-http schemes', async () => {
    const result = await fetchAndExtract('file:///etc/passwd');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unsupported_protocol');
  });

  test('rejects literal loopback IP', async () => {
    const result = await fetchAndExtract('http://127.0.0.1/admin');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/private|internal/);
  });

  test('rejects literal private RFC1918 IPs', async () => {
    for (const ip of ['10.0.0.1', '172.16.0.1', '192.168.1.1']) {
      const result = await fetchAndExtract(`http://${ip}/secret`);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/private|internal/);
    }
  });

  test('rejects the AWS EC2 metadata link-local address', async () => {
    const result = await fetchAndExtract('http://169.254.169.254/latest/meta-data');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/private|internal/);
  });

  test('rejects literal IPv6 loopback / link-local', async () => {
    const loopback = await fetchAndExtract('http://[::1]/');
    expect(loopback.ok).toBe(false);
    const linkLocal = await fetchAndExtract('http://[fe80::1]/');
    expect(linkLocal.ok).toBe(false);
  });
});

describe('fetchAndExtract — http behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('surfaces non-2xx as http_<status>', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } })),
    );
    const result = await fetchAndExtract('https://example.com/missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('http_404');
  });

  test('rejects non-html content types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ x: 1 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    const result = await fetchAndExtract('https://example.com/api');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unsupported_content_type/);
  });

  test('extracts a readable article from html', async () => {
    // Minimal HTML Readability will accept — needs enough body text
    // and clear article structure to be treated as content. The
    // <article> wrapper + repeated paragraphs is the canonical shape.
    const html = `<!doctype html><html><head><title>Quantum Computing</title></head><body>
      <article>
        <h1>Quantum Computing</h1>
        <p>Quantum computing is a type of computation that harnesses the collective properties of quantum states, such as superposition, interference, and entanglement, to perform calculations.</p>
        <p>The devices that perform quantum computations are known as quantum computers. They are believed to be able to solve certain computational problems substantially faster than classical computers.</p>
        <p>Though current quantum computers are too small to outperform usual classical computers for practical applications, they are believed to be capable of solving certain computational problems substantially faster.</p>
        <p>The basic unit of information in quantum computing, the qubit, serves the same role as the bit in classical computing. However, unlike a classical bit, which can be in one of two states, a qubit can exist in a superposition of states.</p>
      </article>
    </body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
      ),
    );
    const result = await fetchAndExtract('https://en.wikipedia.org/wiki/Quantum_computing');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.title).toBe('Quantum Computing');
      expect(result.content).toContain('superposition');
      expect(result.truncated).toBe(false);
    }
  });

  test('truncated:true when extracted content exceeds the cap', () => {
    const longPara = 'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(1000);
    const html = `<!doctype html><html><head><title>Long</title></head><body><article><h1>Long</h1><p>${longPara}</p></article></body></html>`;
    const result = extractFromHtml('https://example.com/long', 'https://example.com/long', html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content.length).toBeLessThanOrEqual(URL_FETCHER_LIMITS.maxContentChars);
      expect(result.truncated).toBe(true);
    }
  });

  test('fetch timeout surfaces as fetch_timeout', async () => {
    // Simulate an aborted fetch — Node's fetch raises an AbortError
    // with name === 'AbortError' when the signal fires.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        throw err;
      }),
    );
    const result = await fetchAndExtract('https://example.com/slow');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('fetch_timeout');
  });
});

describe('extractFromHtml', () => {
  test('returns no_article_content when page has no parseable body', () => {
    const result = extractFromHtml(
      'https://example.com/empty',
      'https://example.com/empty',
      '<!doctype html><html><head><title>x</title></head><body></body></html>',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no_article|empty/);
  });

  test('falls back to hostname when article title is missing', () => {
    const html = `<!doctype html><html><head></head><body><article>
      <p>${'real article text '.repeat(50)}</p>
    </article></body></html>`;
    const result = extractFromHtml(
      'https://news.example.org/path',
      'https://news.example.org/path',
      html,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.title.length).toBeGreaterThan(0);
  });
});

describe('fetchAll', () => {
  test('returns empty array for empty input without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await fetchAll([]);
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  test('one failing URL does not block the others', async () => {
    // Mock keyed by URL — fetch order is non-deterministic because
    // each fetchAndExtract awaits DNS first, so a counter-based mock
    // is flaky.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const target = typeof input === 'string' ? input : input.toString();
        if (target.includes('/fail')) throw new Error('network down');
        const goodHtml = `<!doctype html><html><head><title>ok</title></head><body><article><h1>ok</h1><p>${'body text '.repeat(60)}</p></article></body></html>`;
        return new Response(goodHtml, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }),
    );
    const results = await fetchAll([
      'https://example.com/fail',
      'https://example.com/ok',
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(false);
    expect(results[1]?.ok).toBe(true);
    vi.restoreAllMocks();
  });
});
