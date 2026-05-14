import { useCallback, useEffect, useRef, useState } from 'react';

import { useUpdateQuiz } from '@/queries/quiz';
import { toast } from '@/lib/toast';
import type { Quiz, QuizQuestion, QuizSettings } from '@/types/quiz';

const SAVE_DEBOUNCE_MS = 600;

interface UseDraftQuizArgs {
  quiz: Quiz;
}

interface UseDraftQuizReturn {
  draft: Quiz;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setTitle: (title: string) => void;
  setQuestions: (questions: QuizQuestion[]) => void;
  setSettings: (settings: Partial<QuizSettings>) => void;
}

/**
 * Local-first draft state with a debounced server commit. Keeps the editor
 * snappy on every keystroke while persisting in the background. Save failures
 * surface as a toast — they almost always mean the quiz is no longer a draft
 * (someone launched it from another tab) and the editor should reload.
 */
export function useDraftQuiz({ quiz }: UseDraftQuizArgs): UseDraftQuizReturn {
  const [draft, setDraft] = useState<Quiz>(quiz);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const update = useUpdateQuiz(quiz.id);

  const pendingPatch = useRef<{
    title?: string;
    questions?: QuizQuestion[];
    settings?: Partial<QuizSettings>;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seed local draft when the upstream quiz changes (e.g. user picks a
  // different quiz). We deliberately avoid syncing on every refetch — the
  // local draft is the source of truth while the editor is open.
  const lastQuizId = useRef(quiz.id);
  if (lastQuizId.current !== quiz.id) {
    lastQuizId.current = quiz.id;
    setDraft(quiz);
    setSaveStatus('idle');
    pendingPatch.current = null;
    if (timer.current) clearTimeout(timer.current);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(() => {
    const patch = pendingPatch.current;
    if (!patch) return;
    pendingPatch.current = null;
    setSaveStatus('saving');
    update.mutate(patch, {
      onSuccess: () => setSaveStatus('saved'),
      onError: () => {
        setSaveStatus('error');
        toast.error("Couldn't save your changes. Try again.");
      },
    });
  }, [update]);

  const queue = useCallback(
    (patch: { title?: string; questions?: QuizQuestion[]; settings?: Partial<QuizSettings> }) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const setTitle = useCallback(
    (title: string) => {
      setDraft((d) => ({ ...d, title }));
      queue({ title });
    },
    [queue],
  );

  const setQuestions = useCallback(
    (questions: QuizQuestion[]) => {
      setDraft((d) => ({ ...d, questions }));
      queue({ questions });
    },
    [queue],
  );

  const setSettings = useCallback(
    (settings: Partial<QuizSettings>) => {
      setDraft((d) => ({ ...d, settings: { ...d.settings, ...settings } }));
      queue({ settings });
    },
    [queue],
  );

  return { draft, saveStatus, setTitle, setQuestions, setSettings };
}
