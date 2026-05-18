import { Plus } from 'lucide-react';

interface CreateTileProps {
  onCreate: () => void;
}

export function CreateTile({ onCreate }: CreateTileProps): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onCreate}
        className="group border-glass-border-strong hover:bg-glass-active focus-visible:ring-blurple flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label="Create a new notes doc"
      >
        <span className="bg-blurple/10 text-blurple flex size-12 items-center justify-center rounded-full transition-transform group-hover:scale-105">
          <Plus className="size-6" aria-hidden />
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-ink text-control font-semibold">New notes</span>
          <span className="text-ink-subtle text-caption">A fresh blank page</span>
        </span>
      </button>
    </li>
  );
}
