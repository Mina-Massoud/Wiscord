import type { QuizDoc } from '../../db/models/index.js';
import type { QuizAttemptDoc, AnswerShape } from '../../db/models/index.js';
import type { QuizQuestion, QuizStatus } from './schemas.js';

/**
 * Pure aggregator for quiz analytics. No DB or transport in here — this
 * function takes the raw documents and returns a fully-built snapshot.
 * Tested in isolation; called by the analytics store on every quiz mutation.
 */

export interface QuestionBreakdown {
  questionId: string;
  prompt: string;
  type: QuizQuestion['type'];
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  distribution: Array<{ key: string; label: string; count: number }>;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  answeredCount: number;
  submittedAt: string | null;
}

export interface QuizAnalyticsSnapshot {
  quizId: string;
  status: QuizStatus;
  totalQuestions: number;
  participantCount: number;
  submittedCount: number;
  averageScore: number;
  accuracy: number;
  perQuestion: QuestionBreakdown[];
  leaderboard: LeaderboardEntry[];
  updatedAt: string;
}

export interface DisplayNameLookup {
  (userId: string): string;
}

export function computeSnapshot(params: {
  quiz: QuizDoc;
  attempts: QuizAttemptDoc[];
  displayNameOf: DisplayNameLookup;
}): QuizAnalyticsSnapshot {
  const { quiz, attempts, displayNameOf } = params;
  const totalQuestions = quiz.questions.length;
  const participantCount = attempts.length;
  const submittedCount = attempts.filter((a) => a.submittedAt !== null).length;

  const finalized = attempts.filter((a) => a.submittedAt !== null);
  const averageScore =
    finalized.length === 0
      ? 0
      : finalized.reduce((sum, a) => sum + a.score, 0) / finalized.length;

  const perQuestion = quiz.questions.map((q: QuizQuestion) => buildBreakdown(q, attempts));

  let totalAnswered = 0;
  let totalCorrect = 0;
  for (const row of perQuestion) {
    totalAnswered += row.answeredCount;
    totalCorrect += row.correctCount;
  }
  const accuracy = totalAnswered === 0 ? 0 : totalCorrect / totalAnswered;

  const leaderboard = buildLeaderboard(attempts, displayNameOf);

  return {
    quizId: String(quiz._id),
    status: quiz.status,
    totalQuestions,
    participantCount,
    submittedCount,
    averageScore,
    accuracy,
    perQuestion,
    leaderboard,
    updatedAt: new Date().toISOString(),
  };
}

function buildBreakdown(question: QuizQuestion, attempts: QuizAttemptDoc[]): QuestionBreakdown {
  const buckets = new Map<string, { label: string; count: number }>();
  seedBuckets(question, buckets);

  let answeredCount = 0;
  let correctCount = 0;

  for (const attempt of attempts) {
    const ans = attempt.answers.find((a: AnswerShape) => a.questionId === question.id);
    if (!ans) continue;
    answeredCount += 1;
    if (ans.autoCorrect === true) correctCount += 1;
    addToDistribution(question, ans, buckets);
  }

  const distribution = Array.from(buckets.entries(), ([key, value]) => ({
    key,
    label: value.label,
    count: value.count,
  }));

  return {
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    answeredCount,
    correctCount,
    accuracy: answeredCount === 0 ? 0 : correctCount / answeredCount,
    distribution,
  };
}

function seedBuckets(
  question: QuizQuestion,
  buckets: Map<string, { label: string; count: number }>,
): void {
  if (question.type === 'mcq_single' || question.type === 'mcq_multi') {
    for (const opt of question.options) {
      buckets.set(opt.id, { label: opt.text || '—', count: 0 });
    }
    return;
  }
  if (question.type === 'true_false') {
    buckets.set('true', { label: 'True', count: 0 });
    buckets.set('false', { label: 'False', count: 0 });
    return;
  }
  // short-answer: distribution is filled on the fly with each unique trimmed text
}

function addToDistribution(
  question: QuizQuestion,
  ans: AnswerShape,
  buckets: Map<string, { label: string; count: number }>,
): void {
  if (question.type === 'mcq_single' || question.type === 'mcq_multi') {
    for (const id of ans.selectedOptionIds ?? []) {
      const bucket = buckets.get(id);
      if (bucket) bucket.count += 1;
    }
    return;
  }
  if (question.type === 'true_false') {
    const key = ans.selectedBool === true ? 'true' : ans.selectedBool === false ? 'false' : null;
    if (key) {
      const bucket = buckets.get(key);
      if (bucket) bucket.count += 1;
    }
    return;
  }
  // short-answer: bucket by trimmed lowercase text; cap label length
  const raw = (ans.text ?? '').trim();
  if (raw.length === 0) return;
  const key = raw.toLowerCase().slice(0, 64);
  const existing = buckets.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    buckets.set(key, { label: raw.length > 48 ? `${raw.slice(0, 45)}…` : raw, count: 1 });
  }
}

function buildLeaderboard(
  attempts: QuizAttemptDoc[],
  displayNameOf: DisplayNameLookup,
): LeaderboardEntry[] {
  return [...attempts]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.submittedAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = b.submittedAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })
    .slice(0, 20)
    .map((a) => ({
      userId: a.userId,
      displayName: displayNameOf(a.userId),
      score: a.score,
      answeredCount: a.answers.length,
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
    }));
}
