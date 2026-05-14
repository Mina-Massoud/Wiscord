import { Tv2, type LucideIcon } from 'lucide-react';

/**
 * Static registry of activities surfaced by the launcher dialog. v1 has one
 * entry — Watch Together — and the registry shape exists mostly so adding a
 * second activity later is a one-line append, not a UI rewrite.
 *
 * Each activity is identified by its `id` slug. The launcher fires a
 * callback with the chosen `ActivityDefinition`; the parent surface (today,
 * `VoiceLabPage`) decides how to enter the activity state — there is no
 * routing here, by design: activities live *inside* the voice channel.
 *
 * The `icon` is the literal lucide glyph for the metadata strip. No
 * Sparkles unless the activity is *actually* AI-driven (CLAUDE.md icon
 * rules).
 */
export type ActivityId = 'watch-together';

export interface ActivityDefinition {
  id: ActivityId;
  title: string;
  blurb: string;
  icon: LucideIcon;
}

export const ACTIVITY_REGISTRY: readonly ActivityDefinition[] = [
  {
    id: 'watch-together',
    title: 'Watch Together',
    blurb: 'Sync a video with everyone in the channel.',
    icon: Tv2,
  },
] as const;

export function findActivity(id: ActivityId): ActivityDefinition | undefined {
  return ACTIVITY_REGISTRY.find((a) => a.id === id);
}
