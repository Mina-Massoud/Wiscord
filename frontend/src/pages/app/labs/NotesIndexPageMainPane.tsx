import { NotesBoardCard } from '@/components/notes/NotesBoardCard';
import type { NotesSummary } from '@/types/notes';
import { CreateTile } from './NotesIndexPageCreateTile';
import { EmptyState } from './NotesIndexPageEmptyState';
import { ErrorMain } from './NotesIndexPageErrorMain';
import { Hero } from './NotesIndexPageHero';
import { MainSkeleton } from './NotesIndexPageMainSkeleton';

interface MainPaneProps {
  docs: NotesSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenDoc: (channelId: string) => void;
  onCreate: () => void;
}

export function MainPane({
  docs,
  isLoading,
  isError,
  onRetry,
  onOpenDoc,
  onCreate,
}: MainPaneProps): React.JSX.Element {
  if (isLoading) return <MainSkeleton />;
  if (isError) return <ErrorMain onRetry={onRetry} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <Hero docCount={docs.length} onCreate={onCreate} />

      <section className="flex flex-col gap-4 px-8 pt-2 pb-10">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-ink text-subhead font-semibold">Your notes</h2>
          <span className="text-ink-subtle text-caption">Most recently edited first</span>
        </header>

        {docs.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <CreateTile onCreate={onCreate} />
            {docs.map((doc) => (
              <NotesBoardCard
                key={doc.channelId}
                channelId={doc.channelId}
                updatedAt={doc.updatedAt}
                onOpen={() => onOpenDoc(doc.channelId)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
