import { findActivity } from './ActivityRegistry';
import { Button } from '@/components/ui/button';
import type { ActivityKind } from '@/queries/client';
import type { ActivityGroup } from './ActiveActivitiesOverlay';

interface ActivityInProgressCardProps {
  group: ActivityGroup;
  onJoin: (kind: ActivityKind) => void;
}

/**
 * Kind-specific gerund for the "X is ___ing" status line. Tells the
 * voice-channel viewer what's *actually happening* in the activity at a
 * glance, not just that someone is "here". Verbs lean Gen Z but stay
 * literal — `cooking` reads as "they're in the kitchen" without needing
 * an emoji or sparkles glyph.
 */
const ACTIVITY_VERB: Record<ActivityKind, string> = {
  youtube: 'watching',
  'screen-share': 'sharing',
  notes: 'writing',
  whiteboard: 'drawing',
  quiz: 'cooking',
  pomodoro: 'locked in',
};

export function ActivityInProgressCard({
  group,
  onJoin,
}: ActivityInProgressCardProps): React.JSX.Element {
  const definition = findActivity(group.kind);
  if (!definition) {
    // Defensive — registry should always have every kind. If it doesn't,
    // render nothing rather than throw inside the voice grid render loop.
    return <></>;
  }
  const Icon = definition.icon;
  const Glyph = definition.cover.glyph;
  const [first, ...rest] = group.participants;
  const firstName = first?.name?.trim() || 'Someone';
  const verb = ACTIVITY_VERB[group.kind];
  const subtitle =
    rest.length === 0
      ? `${firstName} is ${verb}`
      : rest.length === 1
        ? `${firstName} + 1 other are ${verb}`
        : `${firstName} + ${rest.length} others are ${verb}`;

  return (
    <div
      className="bg-glass-surface-1 border-glass-border flex items-center gap-3 overflow-hidden rounded-lg border p-3"
      role="group"
      aria-label={`${definition.title} in progress`}
    >
      <span
        aria-hidden
        className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md"
        style={{ backgroundImage: definition.cover.gradient }}
      >
        <Glyph className="text-ink size-6 opacity-90" strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-ink text-tab flex items-center gap-2 truncate font-semibold">
          <Icon className="text-ink-muted size-4 shrink-0" aria-hidden />
          {definition.title}
        </p>
        <p className="text-ink-muted text-caption truncate">{subtitle}</p>
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="rounded-pill shrink-0"
        onClick={() => onJoin(group.kind)}
      >
        Join
      </Button>
    </div>
  );
}
