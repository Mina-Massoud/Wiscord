/**
 * Frontend types for the quiz module. Mirrors the Zod-derived backend types
 * but kept local so the frontend doesn't take a hard dep on backend code.
 *
 * Two question shapes:
 *   - `QuizQuestion`        — host edit shape (full data, includes correctness)
 *   - `RedactedQuestion`    — participant shape (no correctness, no explanations)
 */

export type QuizStatus = 'draft' | 'live' | 'open' | 'closed';
export type QuizMode = 'live' | 'async';

export interface QuizSettings {
  timePerQuestionSec: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showLeaderboard: boolean;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface McqSingleQuestion {
  id: string;
  type: 'mcq_single';
  prompt: string;
  options: QuizOption[];
  explanation?: string;
}

export interface McqMultiQuestion {
  id: string;
  type: 'mcq_multi';
  prompt: string;
  options: QuizOption[];
  explanation?: string;
}

export interface TrueFalseQuestion {
  id: string;
  type: 'true_false';
  prompt: string;
  correct: boolean;
  explanation?: string;
}

export interface ShortAnswerQuestion {
  id: string;
  type: 'short';
  prompt: string;
  referenceAnswer?: string;
  explanation?: string;
}

export type QuizQuestion =
  | McqSingleQuestion
  | McqMultiQuestion
  | TrueFalseQuestion
  | ShortAnswerQuestion;

export type QuizQuestionType = QuizQuestion['type'];

export interface Quiz {
  id: string;
  channelId: string;
  hostUserId: string;
  title: string;
  status: QuizStatus;
  mode: QuizMode | null;
  questions: QuizQuestion[];
  settings: QuizSettings;
  liveState: {
    currentQuestionIndex: number;
    questionStartedAt: string;
    revealing: boolean;
  } | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Participant-facing redacted shape ──────────────────────────────────────

export type RedactedQuestion =
  | {
      id: string;
      type: 'mcq_single' | 'mcq_multi';
      prompt: string;
      options: { id: string; text: string }[];
    }
  | { id: string; type: 'true_false'; prompt: string }
  | { id: string; type: 'short'; prompt: string };

export interface RedactedQuiz {
  id: string;
  channelId: string;
  hostUserId: string;
  title: string;
  status: QuizStatus;
  mode: QuizMode | null;
  questions: RedactedQuestion[];
  settings: QuizSettings;
}

// ── Attempts ───────────────────────────────────────────────────────────────

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  selectedBool?: boolean;
  text?: string;
  answeredAt: string;
  autoCorrect: boolean | null;
  hostGraded: boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  answers: AttemptAnswer[];
  score: number;
  createdAt: string;
  updatedAt: string;
}

// ── REST envelopes ─────────────────────────────────────────────────────────

export interface QuizListResponse {
  quizzes: Quiz[];
}

export type QuizDetailResponse =
  | { role: 'host'; quiz: Quiz }
  | { role: 'participant'; quiz: RedactedQuiz };

export interface QuizMutationResponse {
  quiz: Quiz;
}

export interface AttemptResponse {
  attempt: QuizAttempt;
}

export interface AttemptListResponse {
  attempts: QuizAttempt[];
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface QuizDistributionBucket {
  key: string;
  label: string;
  count: number;
}

export interface QuizQuestionBreakdown {
  questionId: string;
  prompt: string;
  type: QuizQuestionType;
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  distribution: QuizDistributionBucket[];
}

export interface QuizLeaderboardEntry {
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
  perQuestion: QuizQuestionBreakdown[];
  leaderboard: QuizLeaderboardEntry[];
  updatedAt: string;
}

export interface QuizAnalyticsResponse {
  analytics: QuizAnalyticsSnapshot | null;
}
