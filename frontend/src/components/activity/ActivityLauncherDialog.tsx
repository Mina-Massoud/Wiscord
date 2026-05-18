import { useMemo, useState, type ChangeEvent } from 'react';
import { Search } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ActivityCard } from './ActivityCard';
import { ACTIVITY_REGISTRY, type ActivityDefinition } from './ActivityRegistry';

interface ActivityLauncherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fired when the user selects an available activity. The dialog closes
   * itself first, then invokes the callback so the parent can enter the
   * activity state (mount the embed / start a source picker / etc).
   * `coming-soon` activities never reach this callback — their tile is
   * non-interactive.
   */
  onSelect: (activity: ActivityDefinition) => void;
}

/**
 * The launcher dialog. Activities are picked here and entered *in place* —
 * no navigation. The parent surface (`VoiceLabPage`) owns the resulting
 * state transition; this component is a pure picker.
 *
 * Layout follows the ElevenLabs / Manus integration-picker pattern — wider
 * surface, denser tile rhythm. 2-col under md (mobile / narrow viewport
 * fallback), 3-col at md+ where the 5-tile grid breathes properly.
 */
export function ActivityLauncherDialog({
  open,
  onOpenChange,
  onSelect,
}: ActivityLauncherDialogProps): React.JSX.Element {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return ACTIVITY_REGISTRY;
    return ACTIVITY_REGISTRY.filter(
      (a) => a.title.toLowerCase().includes(needle) || a.blurb.toLowerCase().includes(needle),
    );
  }, [query]);

  const handleSelect = (activity: ActivityDefinition) => {
    onOpenChange(false);
    onSelect(activity);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-glass-surface-2 border-glass-border max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-ink text-subhead font-semibold">
            Start an activity
          </DialogTitle>
          <p className="text-ink-muted text-caption mt-1">
            Everyone in this voice channel joins automatically.
          </p>
        </DialogHeader>

        <div className="px-6 pt-4 pb-4">
          <div className="relative">
            <Search
              className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search activities"
              className="bg-surface-composer pl-9"
              aria-label="Search activities"
            />
          </div>
        </div>

        <div className="overflow-y-auto px-6 pb-6">
          <p className="text-ink-muted text-caption mb-3 font-semibold tracking-[0.12em] uppercase">
            Activities
          </p>
          {filtered.length === 0 ? (
            <p className="text-ink-muted text-caption py-12 text-center">
              No matches. Try a different search.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filtered.map((activity) => (
                <ActivityCard key={activity.kind} activity={activity} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
