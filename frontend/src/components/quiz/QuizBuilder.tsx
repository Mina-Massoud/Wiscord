import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { isQuizLaunchable, makeQuestion } from './lib/draft-quiz';
import { useDraftQuiz } from './lib/useDraftQuiz';
import { useQuizBuilderStore } from './lib/useQuizBuilderStore';
import { QuizLaunchDialog } from './QuizLaunchDialog';
import { QuizQuestionEditor } from './QuizQuestionEditor';
import { QuizQuestionList } from './QuizQuestionList';
import { QuizSettingsPanel } from './QuizSettingsPanel';
import type { Quiz, QuizMode, QuizQuestion } from '@/types/quiz';
import { EmptyEditor } from './QuizBuilderEmptyEditor';
import { SaveStatusPill } from './QuizBuilderSaveStatusPill';

interface QuizBuilderProps {
  quiz: Quiz;
  onLaunched: (mode: QuizMode) => void;
}

/**
 * Top-level builder layout. The right-rail preview is mounted by the page
 * (so it can sit in the AppShell's `rightRail` slot). This component owns
 * everything inside `main`: question list (left) + editor (right). The
 * selection + live draft is mirrored into `useQuizBuilderStore` so the
 * right-rail preview can track the same question and reflect every
 * keystroke.
 */
export function QuizBuilder({ quiz, onLaunched }: QuizBuilderProps): React.JSX.Element {
  const { draft, saveStatus, setTitle, setQuestions, setSettings } = useDraftQuiz({ quiz });
  const [selectedId, setSelectedId] = useState<string | null>(quiz.questions[0]?.id ?? null);
  const [launchOpen, setLaunchOpen] = useState(false);

  const selectedQuestion = useMemo(
    () => draft.questions.find((q) => q.id === selectedId) ?? null,
    [draft.questions, selectedId],
  );

  // If the selection is missing (initial mount with no questions, or the
  // selected question was just deleted), snap to the first question.
  const effectiveSelectedId =
    selectedQuestion?.id ?? draft.questions[0]?.id ?? null;

  const publish = useQuizBuilderStore((s) => s.publish);
  const resetStore = useQuizBuilderStore((s) => s.reset);

  useEffect(() => {
    publish({
      quizId: quiz.id,
      selectedQuestionId: effectiveSelectedId,
      questions: draft.questions,
    });
  }, [publish, quiz.id, effectiveSelectedId, draft.questions]);

  useEffect(() => {
    return () => {
      resetStore();
    };
  }, [resetStore]);

  const updateQuestion = (next: QuizQuestion): void => {
    setQuestions(draft.questions.map((q) => (q.id === next.id ? next : q)));
  };

  const addQuestion = (): void => {
    const q = makeQuestion('mcq_single');
    setQuestions([...draft.questions, q]);
    setSelectedId(q.id);
  };

  const removeQuestion = (id: string): void => {
    const next = draft.questions.filter((q) => q.id !== id);
    setQuestions(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const launchable = isQuizLaunchable(draft.questions);
  const selectedIndex = selectedQuestion
    ? draft.questions.findIndex((q) => q.id === selectedQuestion.id) + 1
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-glass-border bg-glass-chrome flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <Input
          value={draft.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled quiz"
          maxLength={120}
          className="text-ink text-subhead h-9 max-w-md border-transparent bg-transparent font-semibold"
          aria-label="Quiz title"
        />
        <div className="flex items-center gap-3">
          <SaveStatusPill status={saveStatus} />
          <Button
            variant="default"
            disabled={!launchable}
            onClick={() => setLaunchOpen(true)}
            title={
              launchable ? 'Launch this quiz' : 'Fix the highlighted questions before launching'
            }
          >
            <Play className="mr-2 size-4" aria-hidden />
            Launch quiz
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-quiz-list shrink-0">
          <QuizQuestionList
            questions={draft.questions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addQuestion}
            onRemove={removeQuestion}
            onReorder={setQuestions}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {selectedQuestion ? (
            <QuizQuestionEditor
              question={selectedQuestion}
              questionNumber={selectedIndex}
              totalQuestions={draft.questions.length}
              onChange={updateQuestion}
            />
          ) : (
            <EmptyEditor onAdd={addQuestion} />
          )}

          <QuizSettingsPanel settings={draft.settings} onChange={setSettings} />
        </div>
      </div>

      <QuizLaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        quizId={quiz.id}
        quizTitle={draft.title}
        onLaunched={onLaunched}
      />
    </div>
  );
}
