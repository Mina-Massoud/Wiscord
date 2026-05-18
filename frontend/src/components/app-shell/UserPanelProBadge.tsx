import { useSubscription } from '@/queries/billing';

/**
 * Tiny "pro" lozenge that sits inline next to the username in
 * UserPanel. Returns null for free users so the panel layout stays
 * identical for everyone — pro is a flex, not a layout shift.
 *
 * Why lowercase "pro" instead of uppercase "PRO":
 *   - Genz register stays consistent with the rest of the AI surface
 *     copy ("not now", "upgrade · $9/mo", "you're out of messages")
 *   - Tracking-wider sells the badge feel without shouting
 *   - Uppercase + tracking is the SaaS-corporate trope we're avoiding
 *
 * No icon. Per the HIG rule in CLAUDE.md, the only literal lucide
 * icons that would fit ("Crown", "Star") aren't in the project's
 * approved set and would read as gamification, not status. Pure type
 * does more.
 *
 * H2 — failure preservation: don't collapse `{loading, error, free}`
 * into the same `return null`. On error, TanStack Query keeps the
 * last successful `data` around — so a Pro user with a transient
 * network blip keeps their badge instead of seeing it vanish (which
 * reads as a silent downgrade). On the initial load we still render
 * nothing — there's no skeleton because the badge is inline next to
 * the username and a shimmer there would be visual noise.
 */
export function UserPanelProBadge(): React.JSX.Element | null {
  const { data, isLoading } = useSubscription();
  // Initial first-paint: no data yet, no error. Render nothing
  // rather than a skeleton — the badge is a sub-element of the
  // username row and a shimmer there is noisier than a brief
  // absence.
  if (isLoading) return null;
  // `data` survives transient errors (TanStack Query semantics:
  // `data` only clears on `queryFn` returning successfully). So
  // `data?.tier === 'pro'` here is the right read even mid-error.
  if (data?.tier !== 'pro') return null;

  return (
    <span
      className="bg-blurple/15 text-blurple text-badge ml-1.5 inline-flex shrink-0 items-center rounded px-1.5 py-px font-bold tracking-[0.12em] uppercase"
      aria-label="Pro subscriber"
    >
      pro
    </span>
  );
}

/**
 * Avatar ring class for pro users — subtle blurple halo that reads
 * as "this person is on the paid plan" without competing with the
 * presence dot already pinned at the bottom-right corner.
 *
 * Returned as a class string (not a component) so the caller can
 * compose it onto the existing `<MediaImg>` className alongside
 * `rounded-full size-8`. Free users get the empty string and the
 * existing layout is unchanged.
 */
export function useProAvatarRingClass(): string {
  const { data } = useSubscription();
  if (data?.tier !== 'pro') return '';
  // ring-offset paints a small gap between avatar and ring so the
  // halo reads as a frame rather than a tinted border. Offset color
  // matches the surface the avatar sits on (glass-callout).
  return 'ring-2 ring-blurple ring-offset-2 ring-offset-glass-callout';
}
