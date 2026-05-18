import { FileText, MessageCircle, Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { useStartCheckout } from '@/queries/billing';
import type { QuotaExceededInfo } from '@/queries/ai';

/**
 * Quota-cap upgrade prompt — the only paywall surface in the app.
 *
 * Visual rules followed (see frontend/CLAUDE.md):
 *   - NO magic icons. Sparkles / Wand / Stars are reserved for
 *     surfaces where the AI is the active mechanism, which this
 *     isn't. Header has no icon at all. Feature rows use literal
 *     lucide icons (MessageCircle / FileText / Mic) because each
 *     icon names a real product surface.
 *   - NO emojis in chrome. Voice can be genz without an emoji crutch.
 *   - One accent per surface. Blurple is the upgrade CTA; the rest
 *     of the chrome stays ink + subtle borders.
 *
 * Composition (per Mobbin research):
 *   - "Wiscord Pro" brand line at top stands in for an icon
 *   - Conversational H1 names the cap the user hit
 *   - One-sentence subhead frames the swap
 *   - "What changes" card with three literal rows is the conversion
 *     mechanic — concrete swaps the user understands instantly
 *   - Reset countdown footer + two right-aligned actions
 */
interface UpgradePromptDialogProps {
  /** The quota hit. Null when the dialog is dismissed. */
  info: QuotaExceededInfo | null;
  /** Called when the user closes the dialog without upgrading. */
  onDismiss: () => void;
}

interface FeatureSwap {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  free: string;
  pro: string;
}

const FEATURE_SWAPS: FeatureSwap[] = [
  { icon: MessageCircle, label: 'messages', free: '30/day', pro: 'no cap' },
  { icon: FileText, label: 'url notes', free: '3/day', pro: '30/day' },
  { icon: Mic, label: 'voice rooms', free: '30 min', pro: 'no cap' },
];

export function UpgradePromptDialog({
  info,
  onDismiss,
}: UpgradePromptDialogProps): React.JSX.Element | null {
  const checkout = useStartCheckout();

  if (info === null) return null;

  function handleUpgrade(): void {
    checkout.mutate(window.location.pathname, {
      onSuccess: (res) => {
        // Hand off to Stripe Checkout. The CheckoutReturnHandler at
        // the App root picks up `?checkout=success` on the way back.
        window.location.href = res.url;
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'something broke. try again?';
        toast.error("couldn't open upgrade flow.", { description: message });
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onDismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <p className="text-ink-muted text-badge font-semibold tracking-[0.16em] uppercase">
            Wiscord Pro
          </p>
          <DialogTitle className="text-ink text-display normal-case">{titleFor(info)}</DialogTitle>
          <DialogDescription className="text-ink-muted text-control normal-case">
            {descriptionFor(info)}
          </DialogDescription>
        </DialogHeader>

        <div className="border-glass-border bg-glass-surface-1 mt-2 divide-y divide-white/5 overflow-hidden rounded-md border">
          {FEATURE_SWAPS.map((row) => (
            <FeatureSwapRow key={row.label} row={row} />
          ))}
        </div>

        <p className="text-ink-subtle text-badge pt-1 text-center normal-case">
          back in {formatResetAt(info.resetAt)}
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onDismiss} disabled={checkout.isPending}>
            not now
          </Button>
          <Button onClick={handleUpgrade} disabled={checkout.isPending}>
            {checkout.isPending ? 'opening…' : 'upgrade · $9/mo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One row in the "what changes" card. Literal icon, label, then the
 * free → pro swap rendered with a soft arrow between two values so
 * the eye reads it as "before → after" without reading text.
 */
function FeatureSwapRow({ row }: { row: FeatureSwap }): React.JSX.Element {
  const Icon = row.icon;
  return (
    <div className="text-control flex items-center gap-3 px-4 py-3">
      <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
      <span className="text-ink flex-1 normal-case">{row.label}</span>
      <span className="text-ink-subtle tabular-nums">{row.free}</span>
      <span className="text-ink-subtle" aria-hidden>
        →
      </span>
      <span className="text-blurple font-medium tabular-nums">{row.pro}</span>
    </div>
  );
}

function titleFor(info: QuotaExceededInfo): string {
  if (info.kind === 'url_note') return "you're out of url notes for today";
  return "you're out of messages for today";
}

function descriptionFor(info: QuotaExceededInfo): string {
  if (info.kind === 'url_note') {
    return 'free gets you 3/day. pro gets you 30 — basically no counter.';
  }
  return "free hits a wall at 30/day. pro just… doesn't.";
}

/**
 * Relative reset countdown. We never show "in X minutes" because by
 * the time the user reads it the value is stale; "under an hour" is
 * close enough. Past 24h we say "tomorrow" — the actual midnight UTC
 * boundary doesn't matter for the conversion moment.
 */
function formatResetAt(iso: string): string {
  try {
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return 'a few hours';
    const hours = Math.round(ms / (60 * 60 * 1000));
    if (hours < 1) return 'under an hour';
    if (hours === 1) return 'about an hour';
    if (hours < 24) return `about ${hours} hours`;
    return 'tomorrow';
  } catch {
    return 'a few hours';
  }
}
