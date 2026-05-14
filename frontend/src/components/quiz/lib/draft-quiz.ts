import type {
  McqMultiQuestion,
  McqSingleQuestion,
  QuizOption,
  QuizQuestion,
  QuizQuestionType,
  ShortAnswerQuestion,
  TrueFalseQuestion,
} from '@/types/quiz';

/**
 * Pure helpers for building, editing, and validating quiz drafts. No React.
 *
 * Components hold the draft in local state for fast keystrokes; the parent
 * `QuizBuilder` debounces and persists via `useUpdateQuiz`. These helpers
 * keep every mutation immutable so React can rely on identity comparisons.
 */

let counter = 0;

export function generateQuestionId(): string {
  counter += 1;
  return `q_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function generateOptionId(): string {
  counter += 1;
  return `o_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function makeOption(overrides: Partial<QuizOption> = {}): QuizOption {
  return {
    id: overrides.id ?? generateOptionId(),
    text: overrides.text ?? '',
    isCorrect: overrides.isCorrect ?? false,
    explanation: overrides.explanation,
  };
}

export function makeQuestion(type: QuizQuestionType): QuizQuestion {
  const id = generateQuestionId();
  switch (type) {
    case 'mcq_single':
      return {
        id,
        type: 'mcq_single',
        prompt: '',
        options: [makeOption({ isCorrect: true }), makeOption(), makeOption()],
      };
    case 'mcq_multi':
      return {
        id,
        type: 'mcq_multi',
        prompt: '',
        options: [makeOption({ isCorrect: true }), makeOption(), makeOption()],
      };
    case 'true_false':
      return { id, type: 'true_false', prompt: '', correct: true };
    case 'short':
      return { id, type: 'short', prompt: '' };
  }
}

export function changeQuestionType(
  question: QuizQuestion,
  nextType: QuizQuestionType,
): QuizQuestion {
  if (question.type === nextType) return question;
  // Preserve prompt across type swaps; everything else reseeds.
  const fresh = makeQuestion(nextType);
  return { ...fresh, id: question.id, prompt: question.prompt };
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface QuestionIssue {
  questionId: string;
  field: 'prompt' | 'options' | 'correct';
  message: string;
}

export function validateQuestion(question: QuizQuestion): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  if (question.prompt.trim().length === 0) {
    issues.push({ questionId: question.id, field: 'prompt', message: 'Add a question prompt' });
  }
  if (question.type === 'mcq_single') {
    const correct = question.options.filter((o) => o.isCorrect).length;
    if (question.options.length < 2) {
      issues.push({
        questionId: question.id,
        field: 'options',
        message: 'Add at least two options',
      });
    }
    if (question.options.some((o) => o.text.trim().length === 0)) {
      issues.push({ questionId: question.id, field: 'options', message: 'Each option needs text' });
    }
    if (correct !== 1) {
      issues.push({
        questionId: question.id,
        field: 'correct',
        message: 'Pick exactly one correct option',
      });
    }
  } else if (question.type === 'mcq_multi') {
    const correct = question.options.filter((o) => o.isCorrect).length;
    if (question.options.length < 2) {
      issues.push({
        questionId: question.id,
        field: 'options',
        message: 'Add at least two options',
      });
    }
    if (question.options.some((o) => o.text.trim().length === 0)) {
      issues.push({ questionId: question.id, field: 'options', message: 'Each option needs text' });
    }
    if (correct < 1) {
      issues.push({
        questionId: question.id,
        field: 'correct',
        message: 'Mark at least one correct option',
      });
    }
  }
  return issues;
}

export function validateQuiz(questions: QuizQuestion[]): QuestionIssue[] {
  return questions.flatMap(validateQuestion);
}

export function isQuizLaunchable(questions: QuizQuestion[]): boolean {
  return questions.length > 0 && validateQuiz(questions).length === 0;
}

// ── Type guards (narrow once, use everywhere) ───────────────────────────────

export const isMcqSingle = (q: QuizQuestion): q is McqSingleQuestion => q.type === 'mcq_single';
export const isMcqMulti = (q: QuizQuestion): q is McqMultiQuestion => q.type === 'mcq_multi';
export const isTrueFalse = (q: QuizQuestion): q is TrueFalseQuestion => q.type === 'true_false';
export const isShortAnswer = (q: QuizQuestion): q is ShortAnswerQuestion => q.type === 'short';
