import { useAiQuota } from '@/queries/ai';

/**
 * Low-quota awareness chip — sits above the AI composer and surfaces
 * when the user is at or near a daily cap. Goal: zero surprise when
 * the cap actually hits. The upgrade dialog still does the
 * conversion on the next ask; this is the heads-up before that.
 *
 * Visibility rules:
 *   - Hidden by default (returns null)
 *   - Low state: message remaining ≤ 5 OR url_note remaining ≤ 1
 *   - Zero state (M2): explicitly distinct treatment for `remaining === 0`,
 *     so the moment the cap is hit the user sees a "0 left — resets at …"
 *     pill BEFORE attempting another ask. Without this, the chip would
 *     disappear at exactly the wrong moment.
 *   - Pro users don't see it under normal use; their caps are 500/30
 *     and any user hitting those needs the chip as an abuse signal
 *
 * No icon. The HIG ban on magic icons rules out sparkles, and no
 * literal lucide icon would mean anything here — a generic clock or
 * alert would add visual noise without information.
 */
export function AiQuotaHint(): React.JSX.Element | null {
  const { data } = useAiQuota();
  if (!data) return null;

  const messages = data.quotas.find((q) => q.kind === 'message');
  const urlNotes = data.quotas.find((q) => q.kind === 'url_note');

  // Zero state wins outright — once the cap hits, the user needs
  // to know now, not "X left" copy.
  if (urlNotes && urlNotes.remaining === 0) {
    return <ExhaustedChip kind="url note" resetAt={urlNotes.resetAt} />;
  }
  if (messages && messages.remaining === 0) {
    return <ExhaustedChip kind="message" resetAt={messages.resetAt} />;
  }

  const messageLow = messages !== undefined && messages.remaining > 0 && messages.remaining <= 5;
  const urlNoteLow = urlNotes !== undefined && urlNotes.remaining > 0 && urlNotes.remaining <= 1;

  if (!messageLow && !urlNoteLow) return null;

  // Prefer url_note when both are low — it's the rarer cap and the
  // user's likelier conversion trigger. Free has 3/day vs 30/day for
  // messages, so url_note runs out first under realistic use.
  const line = urlNoteLow
    ? formatLine('url note', urlNotes.remaining)
    : formatLine('message', messages!.remaining);

  return (
    <p className="text-ink-subtle text-badge px-2 normal-case" aria-live="polite">
      {line}
    </p>
  );
}

function formatLine(kind: 'message' | 'url note', remaining: number): string {
  if (remaining === 1) return `1 ${kind} left today`;
  return `${remaining} ${kind}s left today`;
}

/**
 * Cap-reached state. Distinct color (destructive-tinted) so the user
 * can clock it at a glance vs the low-but-not-zero state. Renders the
 * reset countdown as a relative phrase so the "resets at midnight UTC"
 * detail doesn't feel like an error log.
 */
function ExhaustedChip({
  kind,
  resetAt,
}: {
  kind: 'message' | 'url note';
  resetAt: string;
}): React.JSX.Element {
  return (
    <p
      className="text-destructive bg-destructive/10 text-badge mx-2 rounded px-2 py-0.5 normal-case"
      aria-live="polite"
    >
      0 {kind}s left — resets {formatResetCopy(resetAt)}
    </p>
  );
}

/**
 * Convert the absolute `resetAt` ISO into a short user-facing phrase.
 * Quotas reset on UTC midnight — for most users that's tonight or
 * tomorrow in their local clock. Keeping the copy fuzzy ("tomorrow"
 * vs "in 4h 12m") because the precise countdown adds anxiety without
 * giving the user anything actionable.
 */
function formatResetCopy(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return 'within the hour';
  if (hours < 6) return `in ${Math.round(hours)}h`;
  return 'tomorrow';
}
