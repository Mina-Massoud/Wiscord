import { WhiteboardBoardCard } from '@/components/whiteboard/WhiteboardBoardCard';
import type { WhiteboardSummary } from '@/types/whiteboard';
import { CreateTile } from './WhiteboardIndexPageCreateTile';
import { EmptyState } from './WhiteboardIndexPageEmptyState';
import { ErrorMain } from './WhiteboardIndexPageErrorMain';
import { Hero } from './WhiteboardIndexPageHero';
import { MainSkeleton } from './WhiteboardIndexPageMainSkeleton';

interface MainPaneProps {
  boards: WhiteboardSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenBoard: (channelId: string) => void;
  onCreate: () => void;
}

export function MainPane({
  boards,
  isLoading,
  isError,
  onRetry,
  onOpenBoard,
  onCreate,
}: MainPaneProps): React.JSX.Element {
  if (isLoading) return <MainSkeleton />;
  if (isError) return <ErrorMain onRetry={onRetry} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <Hero boardCount={boards.length} onCreate={onCreate} />

      <section className="flex flex-col gap-4 px-8 pt-2 pb-10">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-ink text-subhead font-semibold">Your whiteboards</h2>
          <span className="text-ink-subtle text-caption">Most recently edited first</span>
        </header>

        {boards.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <ul
            role="list"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <CreateTile onCreate={onCreate} />
            {boards.map((board) => (
              <WhiteboardBoardCard
                key={board.channelId}
                channelId={board.channelId}
                updatedAt={board.updatedAt}
                onOpen={() => onOpenBoard(board.channelId)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
