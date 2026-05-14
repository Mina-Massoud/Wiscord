import { PlayCircle } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { ActivityDefinition } from './ActivityRegistry';

interface ActivityCardProps {
  activity: ActivityDefinition;
  onSelect: (activity: ActivityDefinition) => void;
  /**
   * Featured = takes both grid columns and uses a taller cover. Used when
   * there's only one activity in the registry so it doesn't read as a lonely
   * tile.
   */
  featured?: boolean;
}

/**
 * Single tile in the launcher grid. The cover is *generated*, not a webp —
 * a layered radial gradient + one large lucide glyph. This keeps the
 * launcher coherent with Wiscord's no-stock-art aesthetic and means the
 * registry can grow without anyone uploading screenshots.
 *
 * Visual rules (locked in the frontend-design spec):
 *  - bg-glass-surface-1 + glass-border, no shadow lift on hover
 *  - cover gradient shifts hue ~8° on hover for a subtle signature beat
 *  - blurple appears only on the focus ring (one accent per surface)
 *  - icon in the metadata strip is the activity's literal icon, never magic
 */
export function ActivityCard({
  activity,
  onSelect,
  featured = false,
}: ActivityCardProps): React.JSX.Element {
  const Icon = activity.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(activity)}
      className={cn(
        'group bg-glass-surface-1 border-glass-border ease-wiscord duration-fast hover:border-glass-border-strong focus-visible:ring-blurple focus-visible:ring-offset-glass-surface-2 flex flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]',
        featured && 'col-span-2',
      )}
      aria-label={`Start ${activity.title}`}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden',
          featured ? 'aspect-[21/9]' : 'aspect-[16/9]',
        )}
        aria-hidden
      >
        <div
          className="ease-wiscord duration-base absolute inset-0 group-hover:[filter:hue-rotate(8deg)]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 40%, #5865F2 0%, #1F1B3A 45%, #0A0A0C 100%)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <PlayCircle
            className={cn('text-ink opacity-80', featured ? 'size-20' : 'size-14')}
            strokeWidth={1.25}
          />
        </div>
      </div>
      <div className="border-glass-border flex items-start gap-2 border-t px-4 py-3">
        <Icon className="text-ink-muted mt-px size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-ink text-tab truncate font-semibold">{activity.title}</p>
          <p className="text-ink-muted text-caption line-clamp-2">{activity.blurb}</p>
        </div>
      </div>
    </button>
  );
}
