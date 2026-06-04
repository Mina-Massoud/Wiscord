/**
 * Date helpers. Centralized so display formatting stays consistent
 * across the app and locale/timezone bugs only live in one place.
 *
 * Everything accepts ISO strings (what the API returns) and renders in
 * the user's locale. Per the rules, dates travel over the wire as
 * ISO 8601 UTC — local conversion only happens at render time.
 */

const relativeFormatter =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'long' })
    : null;

const absoluteFormatter =
  typeof Intl !== 'undefined' ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }) : null;

const RELATIVE_THRESHOLDS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

/**
 * Human-readable "3 days ago" / "in 5 minutes". Falls back to the
 * absolute date if the input is invalid or `Intl` is unavailable
 * (older Safari, JSDOM). Anchor defaults to "now"; pass an explicit
 * anchor in tests to make the output deterministic.
 */
export function formatRelative(iso: string, anchor: Date = new Date()): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  if (!relativeFormatter) return absoluteFormatter?.format(target) ?? target.toISOString();

  const diffMs = target.getTime() - anchor.getTime();
  const abs = Math.abs(diffMs);

  for (const { unit, ms } of RELATIVE_THRESHOLDS) {
    if (abs >= ms) {
      const value = Math.round(diffMs / ms);
      return relativeFormatter.format(value, unit);
    }
  }

  return relativeFormatter.format(Math.round(diffMs / 1000), 'second');
}

const messageTimeFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

/** Short local time for chat bubbles (e.g. "3:42 PM"). */
export function formatMessageTime(iso: string): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  return messageTimeFormatter?.format(target) ?? target.toISOString();
}
