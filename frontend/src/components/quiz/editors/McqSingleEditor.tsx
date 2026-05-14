import { Plus } from 'lucide-react';
import { Reorder } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/radio-group';

import { makeOption } from '../lib/draft-quiz';
import { SortableOptionRow } from './SortableOptionRow';
import type { McqSingleQuestion, QuizOption } from '@/types/quiz';

interface McqSingleEditorProps {
  question: McqSingleQuestion;
  onChange: (next: McqSingleQuestion) => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

export function McqSingleEditor({ question, onChange }: McqSingleEditorProps): React.JSX.Element {
  const correctId = question.options.find((o) => o.isCorrect)?.id ?? '';

  const setCorrect = (id: string): void => {
    onChange({
      ...question,
      options: question.options.map((o) => ({ ...o, isCorrect: o.id === id })),
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
    const filtered = question.options.filter((o) => o.id !== id);
    // If we removed the correct one, mark the first remaining as correct.
    const stillHasCorrect = filtered.some((o) => o.isCorrect);
    onChange({
      ...question,
      options: stillHasCorrect ? filtered : filtered.map((o, i) => ({ ...o, isCorrect: i === 0 })),
    });
  };

  const reorder = (next: QuizOption[]): void => {
    onChange({ ...question, options: next });
  };

  return (
    <div className="flex flex-col gap-2">
      <RadioGroup value={correctId} onValueChange={setCorrect}>
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
              selectMode="single"
              onChangeText={(text) => updateOptionText(opt.id, text)}
              onToggleCorrect={() => setCorrect(opt.id)}
              onRemove={() => removeOption(opt.id)}
              removeDisabled={question.options.length <= MIN_OPTIONS}
            />
          ))}
        </Reorder.Group>
      </RadioGroup>

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
