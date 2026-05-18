/**
 * Lightweight user-agent → friendly device-line parser. Avoids pulling in
 * a heavy UA library — we only need to render one human-readable string
 * per session, not a full device fingerprint.
 *
 * Examples:
 *   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/… Chrome/120 Safari/537"
 *     → "Chrome on macOS"
 *   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 …) Version/17.0 Mobile/15E148 Safari/604.1"
 *     → "Safari on iOS"
 */
export function parseUserAgent(raw: string | undefined): string {
  if (!raw) return 'Unknown device';

  const browser = detectBrowser(raw);
  const os = detectOs(raw);

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'Unknown device';
}

function detectBrowser(ua: string): string | null {
  // Order matters — Edge / Opera include "Chrome" in their UA, so check first.
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return null;
}

function detectOs(ua: string): string | null {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

/**
 * Mask the last octet of an IPv4 address (or the last group of an IPv6).
 * Good enough for "yep, that's me" recognition without leaking the precise
 * address back to the user.
 */
export function maskIp(raw: string | undefined): string {
  if (!raw) return 'Unknown';
  // Express's req.ip can return ::ffff:1.2.3.4 — strip the v6-mapped prefix.
  const ip = raw.replace(/^::ffff:/, '');

  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.•••`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 1) return `${parts.slice(0, -1).join(':')}:••••`;
  }
  return 'Unknown';
}
