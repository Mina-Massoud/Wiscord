import { Schema, model, type HydratedDocument } from 'mongoose';
import { applySerialize } from '../serialize.js';
import {
  quizQuestionSchema,
  DEFAULT_QUIZ_SETTINGS,
  type QuizQuestion,
  type QuizSettings,
  type QuizStatus,
  type QuizMode,
} from '../../modules/quiz/schemas.js';

/**
 * A quiz authored by a host inside a channel. The `questions` array is stored
 * as `Mixed` (it's a discriminated union — Mongoose can't natively express
 * that) and validated end-to-end by the Zod schema in a Mongoose validator
 * plus on every PATCH at the route boundary. The Zod schema is the single
 * source of truth for shape; the Mongoose validator is a belt-and-braces
 * check so a direct DB write also can't sneak in malformed shape.
 *
 * `liveState` is only populated while `status === 'live'`. The server is the
 * authority on `questionStartedAt` so participants compute remaining time
 * against the server's clock, never their own.
 */

export interface LiveState {
  currentQuestionIndex: number;
  questionStartedAt: Date;
  revealing: boolean;
}

export interface QuizDocShape {
  channelId: string;
  hostUserId: string;
  title: string;
  status: QuizStatus;
  mode: QuizMode | null;
  questions: QuizQuestion[];
  settings: QuizSettings;
  liveState: LiveState | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const liveStateSchema = new Schema(
  {
    currentQuestionIndex: { type: Number, required: true, min: 0 },
    questionStartedAt: { type: Date, required: true },
    revealing: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    timePerQuestionSec: { type: Number, default: DEFAULT_QUIZ_SETTINGS.timePerQuestionSec },
    shuffleQuestions: { type: Boolean, default: DEFAULT_QUIZ_SETTINGS.shuffleQuestions },
    shuffleOptions: { type: Boolean, default: DEFAULT_QUIZ_SETTINGS.shuffleOptions },
    showLeaderboard: { type: Boolean, default: DEFAULT_QUIZ_SETTINGS.showLeaderboard },
  },
  { _id: false },
);

const quizSchema = new Schema(
  {
    channelId: { type: String, required: true, index: true },
    hostUserId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    status: {
      type: String,
      enum: ['draft', 'live', 'open', 'closed'],
      required: true,
      default: 'draft',
      index: true,
    },
    mode: {
      type: String,
      enum: ['live', 'async', null],
      default: null,
    },
    questions: {
      type: [Schema.Types.Mixed],
      default: [],
      validate: {
        validator: (value: unknown) => {
          if (!Array.isArray(value)) return false;
          for (const q of value) {
            const result = quizQuestionSchema.safeParse(q);
            if (!result.success) return false;
          }
          return true;
        },
        message: 'questions failed shape validation',
      },
    },
    settings: { type: settingsSchema, default: () => ({ ...DEFAULT_QUIZ_SETTINGS }) },
    liveState: { type: liveStateSchema, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'quizzes' },
);

quizSchema.index({ channelId: 1, status: 1, updatedAt: -1 });

applySerialize(quizSchema);

export type QuizDoc = HydratedDocument<QuizDocShape>;
export const Quiz = model<QuizDocShape>('Quiz', quizSchema);
