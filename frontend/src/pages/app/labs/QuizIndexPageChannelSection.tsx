import { Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuizCard } from './QuizIndexPageQuizCard';
import type { ChannelGroup } from './QuizIndexPage';

interface ChannelSectionProps {
  group: ChannelGroup;
  onOpenChannel: () => void;
  onOpenQuiz: (quizId: string) => void;
}

export function ChannelSection({
  group,
  onOpenChannel,
  onOpenQuiz,
}: ChannelSectionProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Hash className="text-ink-muted size-4 shrink-0" aria-hidden />
          <h2 className="text-ink text-subhead truncate font-mono">{group.slug}</h2>
          <span className="text-ink-subtle text-badge">
            · {group.quizzes.length} {group.quizzes.length === 1 ? 'quiz' : 'quizzes'}
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenChannel}>
          Open channel
        </Button>
      </header>

      <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} onSelect={() => onOpenQuiz(quiz.id)} />
        ))}
      </ul>
    </section>
  );
}
