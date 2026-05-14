import { EventEmitter } from 'node:events';

import { Quiz, QuizAttempt, User } from '../../db/models/index.js';
import type { QuizAttemptDoc } from '../../db/models/index.js';
import { logger } from '../../lib/logger.js';
import { computeSnapshot, type QuizAnalyticsSnapshot } from './analytics.js';

/**
 * In-memory cache + event bus for quiz analytics snapshots. Mirrors the voice
 * presence store: every mutation in `service.ts` calls `recompute(quizId)`,
 * which re-reads from Mongo, builds a fresh snapshot, caches it, and emits
 * `analytics_changed` so the Socket.IO gateway can fan out to the host room.
 *
 * Single-process for now (same constraint as `VoicePresenceStore`). When we
 * horizontally scale, swap this for a Redis pub/sub adapter.
 */

export declare interface QuizAnalyticsStore {
  on(event: 'analytics_changed', listener: (snapshot: QuizAnalyticsSnapshot) => void): this;
  off(event: 'analytics_changed', listener: (snapshot: QuizAnalyticsSnapshot) => void): this;
  emit(event: 'analytics_changed', snapshot: QuizAnalyticsSnapshot): boolean;
}

export class QuizAnalyticsStore extends EventEmitter {
  private readonly cache = new Map<string, QuizAnalyticsSnapshot>();
  private readonly inflight = new Map<string, Promise<QuizAnalyticsSnapshot | null>>();
  private readonly nameCache = new Map<string, string>();

  /**
   * Recompute the snapshot for a quiz. Deduplicates concurrent calls — if a
   * recompute is already in flight for the same quizId, returns the same
   * promise so we don't hammer Mongo on bursts of submit events.
   */
  recompute(quizId: string): Promise<QuizAnalyticsSnapshot | null> {
    const existing = this.inflight.get(quizId);
    if (existing) return existing;

    const task = this.doRecompute(quizId).finally(() => {
      this.inflight.delete(quizId);
    });
    this.inflight.set(quizId, task);
    return task;
  }

  /**
   * Synchronously return the cached snapshot (or undefined if none yet).
   * The REST snapshot route uses `getOrCompute` instead so the first reader
   * sees data even on a cold start.
   */
  peek(quizId: string): QuizAnalyticsSnapshot | undefined {
    return this.cache.get(quizId);
  }

  async getOrCompute(quizId: string): Promise<QuizAnalyticsSnapshot | null> {
    const cached = this.cache.get(quizId);
    if (cached) return cached;
    return this.recompute(quizId);
  }

  private async doRecompute(quizId: string): Promise<QuizAnalyticsSnapshot | null> {
    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) return null;
      const attempts = await QuizAttempt.find({ quizId: quiz._id });
      await this.primeNameCache(attempts.map((a: QuizAttemptDoc) => a.userId));

      const snapshot = computeSnapshot({
        quiz,
        attempts,
        displayNameOf: (userId) => this.nameCache.get(userId) ?? 'Anonymous',
      });

      const prev = this.cache.get(quizId);
      this.cache.set(quizId, snapshot);

      if (!prev || hasMeaningfulDelta(prev, snapshot)) {
        this.emit('analytics_changed', snapshot);
      }
      return snapshot;
    } catch (err) {
      logger.warn({ err, quizId }, 'quiz-analytics: recompute failed');
      return null;
    }
  }

  private async primeNameCache(userIds: string[]): Promise<void> {
    const missing = userIds.filter((id) => !this.nameCache.has(id));
    if (missing.length === 0) return;
    const users = await User.find({ _id: { $in: missing } }, { username: 1, displayName: 1 });
    for (const u of users) {
      this.nameCache.set(String(u._id), u.displayName ?? u.username ?? 'Anonymous');
    }
    // Backfill anything still missing so we don't re-query on every call.
    for (const id of missing) {
      if (!this.nameCache.has(id)) this.nameCache.set(id, 'Anonymous');
    }
  }
}

/**
 * Don't emit when the snapshot is byte-identical — keeps redundant DB-driven
 * recomputes from spamming sockets when a no-op write happens (e.g. host
 * idempotently launches a live quiz twice).
 */
function hasMeaningfulDelta(prev: QuizAnalyticsSnapshot, next: QuizAnalyticsSnapshot): boolean {
  if (prev.status !== next.status) return true;
  if (prev.participantCount !== next.participantCount) return true;
  if (prev.submittedCount !== next.submittedCount) return true;
  if (prev.averageScore !== next.averageScore) return true;
  if (prev.accuracy !== next.accuracy) return true;
  if (prev.leaderboard.length !== next.leaderboard.length) return true;
  for (let i = 0; i < prev.perQuestion.length; i += 1) {
    const a = prev.perQuestion[i];
    const b = next.perQuestion[i];
    if (!a || !b) return true;
    if (a.answeredCount !== b.answeredCount) return true;
    if (a.correctCount !== b.correctCount) return true;
  }
  for (let i = 0; i < prev.leaderboard.length; i += 1) {
    const a = prev.leaderboard[i];
    const b = next.leaderboard[i];
    if (!a || !b) return true;
    if (a.userId !== b.userId) return true;
    if (a.score !== b.score) return true;
  }
  return false;
}

export const quizAnalytics: QuizAnalyticsStore = new QuizAnalyticsStore();
