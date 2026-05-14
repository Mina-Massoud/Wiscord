import { Schema, model, Types, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';

/**
 * One row per (quizId, userId). Each row holds the participant's answers in
 * an embedded array. Re-attempts are not v1 — uniqueness is enforced.
 *
 * `autoCorrect` is null for short-answer questions until the host grades.
 * `score` is recomputed server-side on every PATCH (answer or grade) so the
 * client never has to reason about scoring.
 */

export interface AnswerShape {
  questionId: string;
  selectedOptionIds?: string[];
  selectedBool?: boolean;
  text?: string;
  answeredAt: Date;
  autoCorrect: boolean | null;
  hostGraded: boolean;
}

export interface QuizAttemptDocShape {
  quizId: Types.ObjectId;
  userId: string;
  startedAt: Date;
  submittedAt: Date | null;
  answers: AnswerShape[];
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    selectedOptionIds: { type: [String], default: undefined },
    selectedBool: { type: Boolean, default: undefined },
    text: { type: String, default: undefined },
    answeredAt: { type: Date, required: true },
    autoCorrect: { type: Boolean, default: null },
    hostGraded: { type: Boolean, default: false },
  },
  { _id: false },
);

const quizAttemptSchema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    userId: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true, default: () => new Date() },
    submittedAt: { type: Date, default: null },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, required: true, default: 0, min: 0, max: 1 },
  },
  { timestamps: true, collection: 'quiz_attempts' },
);

quizAttemptSchema.index({ quizId: 1, userId: 1 }, { unique: true });

applySerialize(quizAttemptSchema);

export type QuizAttemptDoc = HydratedDocument<QuizAttemptDocShape>;
export const QuizAttempt = model<QuizAttemptDocShape>('QuizAttempt', quizAttemptSchema);
