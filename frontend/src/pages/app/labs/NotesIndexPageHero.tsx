import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface HeroProps {
  docCount: number;
  onCreate: () => void;
}

export function Hero({ docCount, onCreate }: HeroProps): React.JSX.Element {
  return (
    <section className="px-8 pt-8 pb-6">
      <div className="bg-glass-callout border-glass-border shadow-glass relative overflow-hidden rounded-2xl border p-8">
        <span
          aria-hidden
          className="bg-blurple absolute -top-20 -right-16 size-64 rounded-full opacity-25 blur-3xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-24 -left-10 size-72 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: 'oklch(68% 0.18 200)' }}
        />
        <div className="relative flex flex-col gap-3">
          <span className="text-ink-subtle text-badge tracking-wider uppercase">Labs · Notes</span>
          <h1 className="text-ink text-display max-w-2xl font-semibold">
            {docCount === 0 ? 'Start your first notes doc.' : 'Pick up where you left off.'}
          </h1>
          <p className="text-ink-muted text-body max-w-xl">
            Live markdown scratchpad for the channel. Type, paste, link, format — every keystroke
            syncs to everyone else in real time. No save button, no lost edits.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onCreate}>
              <Plus className="mr-2 size-4" aria-hidden />
              New notes
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
