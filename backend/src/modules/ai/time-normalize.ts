/**
 * AI tool time normalization.
 *
 * The calendar tools accept ISO 8601 datetime strings from the model.
 * Despite explicit prompt instructions, models routinely emit naive
 * strings ("2026-05-17T18:00:00") or strings with the wrong offset.
 * The fix is to make the server authoritative: if the caller supplied
 * an IANA timezone, treat any naive input as that zone's wall-clock
 * and splice the correct offset on. Offset-aware inputs (`Z` or
 * `±HH:MM`) pass through untouched.
 *
 * Pure module — no I/O, no logging — so it's trivially testable.
 */
const OFFSET_AWARE_RE = /(Z|[+-]\d{2}:?\d{2})$/;
const NAIVE_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/** Permissive shape match for the strict Zod schema. Accepts naive
 *  or offset-aware ISO. Anything else (e.g. `tomorrow`, `5pm`) is a
 *  validation error, not a normalization concern. */
export const STRICT_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * If `input` is offset-aware or `timezone` is missing/invalid → return
 * `input` unchanged. If `input` is naive and `timezone` is a valid
 * IANA zone → return the same wall-clock with the zone's UTC offset
 * appended (DST-correct for that exact instant).
 */
export function normalizeLocalIso(input: string, timezone: string | undefined): string {
  if (OFFSET_AWARE_RE.test(input)) return input;
  if (!timezone || !isValidTimezone(timezone)) return input;
  const m = NAIVE_LOCAL_RE.exec(input);
  if (!m) return input;
  const [, year, month, day, hour, minute, second = '00', ms] = m;
  const offset = offsetForWallClock(timezone, {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  });
  const msSuffix = ms ? `.${ms.padEnd(3, '0')}` : '';
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${msSuffix}${offset}`;
}

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Compute the UTC offset string (`+HH:MM` / `-HH:MM`) that the named
 * IANA zone is using at the given wall-clock moment.
 *
 * Strategy: build a candidate UTC instant from the wall-clock parts
 * as if they were UTC, then re-format that instant back into the
 * target zone. The drift between the original parts and the re-
 * formatted parts is the zone's offset. One refinement pass on the
 * other side of a DST boundary handles spring-forward / fall-back.
 */
function offsetForWallClock(timezone: string, wc: WallClock): string {
  const candidateUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  const offsetMs = utcMinusZoneMs(candidateUtc, timezone);
  const refined = candidateUtc + offsetMs;
  // Re-check at the refined instant to catch DST transitions where
  // the first pass landed on the wrong side.
  const refinedOffsetMs = utcMinusZoneMs(refined, timezone);
  return formatOffset(refinedOffsetMs);
}

/**
 * For a UTC instant, return `utc - zoneLocal` in ms. That difference
 * equals the offset to add to a zone-local instant to get back to
 * UTC — i.e. positive for zones east of UTC.
 */
function utcMinusZoneMs(utcInstantMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcInstantMs));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  let hour = get('hour');
  // Intl can yield 24 for midnight in some locales — normalize.
  if (hour === 24) hour = 0;
  const localAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return localAsUtc - utcInstantMs;
}

function formatOffset(offsetMs: number): string {
  const minutes = Math.round(offsetMs / 60_000);
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Render `date` in the named IANA zone as an offset-aware ISO 8601
 * string (`YYYY-MM-DDTHH:MM:SS±HH:MM`). When `timezone` is missing
 * or invalid, falls back to `date.toISOString()`. Used to format
 * tool-call results so the model sees local-zone strings in its
 * conversation history instead of `Z`.
 */
export function formatInZone(date: Date, timezone: string | undefined): string {
  if (!timezone || !isValidTimezone(timezone)) return date.toISOString();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const offsetMs = utcMinusZoneMs(date.getTime(), timezone);
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}${formatOffset(offsetMs)}`;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
