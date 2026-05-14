import { useMemo, useState } from 'react';
import { Cloud, CloudOff, Loader2, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { isQuizLaunchable, makeQuestion } from './lib/draft-quiz';
import { useDraftQuiz } from './lib/useDraftQuiz';
import { QuizLaunchDialog } from './QuizLaunchDialog';
import { QuizQuestionEditor } from './QuizQuestionEditor';
import { QuizQuestionList } from './QuizQuestionList';
import { QuizSettingsPanel } from './QuizSettingsPanel';
import type { Quiz, QuizMode, QuizQuestion } from '@/types/quiz';

interface QuizBuilderProps {
  quiz: Quiz;
  onLaunched: (mode: QuizMode) => void;
}

/**
 * Top-level builder layout. The right-rail preview is mounted by the page
 * (so it can sit in the AppShell's `rightRail` slot). This component owns
 * everything inside `main`: question list (left) + editor (right).
 *
 * The currently-selected question is local-only ephemeral — no need to put
 * it in the URL.
 */
export function QuizBuilder({ quiz, onLaunched }: QuizBuilderProps): React.JSX.Element {
  const { draft, saveStatus, setTitle, setQuestions, setSettings } = useDraftQuiz({ quiz });
  const [selectedId, setSelectedId] = useState<string | null>(quiz.questions[0]?.id ?? null);
  const [launchOpen, setLaunchOpen] = useState(false);

  const selectedQuestion = useMemo(
    () => draft.questions.find((q) => q.id === selectedId) ?? null,
    [draft.questions, selectedId],
  );

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

function EmptyEditor({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="bg-glass-surface-1 border-glass-border flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-12 text-center">
      <h2 className="text-ink text-subhead font-semibold">Build the first question</h2>
      <p className="text-ink-muted text-caption">
        Pick a type, write the prompt, and the preview on the right updates as you type.
      </p>
      <Button onClick={onAdd}>
        <Play className="mr-2 size-4" aria-hidden />
        Add a question
      </Button>
    </div>
  );
}

function SaveStatusPill({
  status,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
}): React.JSX.Element | null {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="text-ink-muted text-caption flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="text-ink-muted text-caption flex items-center gap-1.5">
        <Cloud className="size-3" aria-hidden />
        Saved
      </span>
    );
  }
  return (
    <span className="text-destructive text-caption flex items-center gap-1.5">
      <CloudOff className="size-3" aria-hidden />
      Save failed
    </span>
  );
}

// Helpers exposed for the page so it can render the right-rail preview using
// the same selected question. Re-importing the editor would couple too much.
export function useSelectedQuestion(
  draft: Quiz,
  selectedId: string | null,
): { question: QuizQuestion | null; index: number; total: number } {
  const idx = selectedId ? draft.questions.findIndex((q) => q.id === selectedId) : -1;
  return {
    question: idx >= 0 ? (draft.questions[idx] ?? null) : null,
    index: idx + 1,
    total: draft.questions.length,
  };
}
