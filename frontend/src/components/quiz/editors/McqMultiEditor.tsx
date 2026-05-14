import { Plus } from 'lucide-react';
import { Reorder } from 'framer-motion';

import { Button } from '@/components/ui/button';

import { makeOption } from '../lib/draft-quiz';
import { SortableOptionRow } from './SortableOptionRow';
import type { McqMultiQuestion, QuizOption } from '@/types/quiz';

interface McqMultiEditorProps {
  question: McqMultiQuestion;
  onChange: (next: McqMultiQuestion) => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

export function McqMultiEditor({ question, onChange }: McqMultiEditorProps): React.JSX.Element {
  const toggleCorrect = (id: string): void => {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === id ? { ...o, isCorrect: !o.isCorrect } : o)),
    });
  };

  const updateOptionText = (id: string, text: string): void => {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });
  };

  const addOption = (): void => {
    if (question.options.length >= MAX_OPTIONS) return;
    onChange({ ...question, options: [...question.options, makeOption()] });
  };

  const removeOption = (id: string): void => {
    if (question.options.length <= MIN_OPTIONS) return;
    onChange({ ...question, options: question.options.filter((o) => o.id !== id) });
  };

  const reorder = (next: QuizOption[]): void => {
    onChange({ ...question, options: next });
  };

  return (
    <div className="flex flex-col gap-2">
      <Reorder.Group
        axis="y"
        values={question.options}
        onReorder={reorder}
        as="ul"
        className="flex flex-col gap-2"
      >
        {question.options.map((opt) => (
          <SortableOptionRow
            key={opt.id}
            option={opt}
            selectMode="multi"
            onChangeText={(text) => updateOptionText(opt.id, text)}
            onToggleCorrect={() => toggleCorrect(opt.id)}
            onRemove={() => removeOption(opt.id)}
            removeDisabled={question.options.length <= MIN_OPTIONS}
          />
        ))}
      </Reorder.Group>

      <Button
        type="button"
        variant="ghost"
        onClick={addOption}
        disabled={question.options.length >= MAX_OPTIONS}
        className="text-ink-muted hover:text-ink justify-start"
      >
        <Plus className="mr-2 size-4" aria-hidden />
        Add option
      </Button>
    </div>
  );
}
