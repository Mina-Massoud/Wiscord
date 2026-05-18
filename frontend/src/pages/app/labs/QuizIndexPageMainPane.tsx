import { ChannelSection } from './QuizIndexPageChannelSection';
import { EmptyMain } from './QuizIndexPageEmptyMain';
import { ErrorMain } from './QuizIndexPageErrorMain';
import { MainSkeleton } from './QuizIndexPageMainSkeleton';
import type { ChannelGroup } from './QuizIndexPage';

interface MainPaneProps {
  groups: ChannelGroup[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenChannel: (channelId: string) => void;
  onOpenQuiz: (channelId: string, quizId: string) => void;
}

export function MainPane({
  groups,
  isLoading,
  isError,
  onRetry,
  onOpenChannel,
  onOpenQuiz,
}: MainPaneProps): React.JSX.Element {
  if (isLoading) return <MainSkeleton />;
  if (isError) return <ErrorMain onRetry={onRetry} />;
  if (groups.length === 0) return <EmptyMain />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-6">
      {groups.map((group) => (
        <ChannelSection
          key={group.channelId}
          group={group}
          onOpenChannel={() => onOpenChannel(group.channelId)}
          onOpenQuiz={(quizId) => onOpenQuiz(group.channelId, quizId)}
        />
      ))}
    </div>
  );
}
