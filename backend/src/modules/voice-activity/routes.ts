import { Router } from 'express';

import { ok } from '../../lib/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  channelIdParam,
  controlBody,
  pinQuizBody,
  pomodoroControlBody,
  setPresenceBody,
  startActivityBody,
  transferHostBody,
} from './schemas.js';
import {
  applyPomodoroControl,
  applyWatchControl,
  getActivity,
  pinQuiz,
  setActivityPresence,
  startActivity,
  stopActivity,
  transferHost,
} from './service.js';

export const voiceActivityRouter: Router = Router();

/**
 * GET /channels/:channelId/activity
 * Returns the active voice-activity snapshot, or null if none is running.
 */
voiceActivityRouter.get('/:channelId/activity', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const snapshot = await getActivity(channelId);
    res.json(ok({ activity: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/start
 * Body: discriminated by `kind`. Caller becomes host.
 */
voiceActivityRouter.post('/:channelId/activity/start', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const body = startActivityBody.parse(req.body);
    const snapshot = await startActivity({ channelId, userId: req.userId!, body });
    res.json(ok({ activity: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/stop
 * Host-only. Idempotent.
 */
voiceActivityRouter.post('/:channelId/activity/stop', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const stopped = await stopActivity({ channelId, userId: req.userId! });
    res.json(ok({ stopped }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/control
 * Watch-only host playback control.
 */
voiceActivityRouter.post('/:channelId/activity/control', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const command = controlBody.parse(req.body);
    const snapshot = await applyWatchControl({ channelId, userId: req.userId!, command });
    res.json(ok({ activity: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/host
 * Transfer host role to another user.
 */
voiceActivityRouter.post('/:channelId/activity/host', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const { toUserId } = transferHostBody.parse(req.body);
    const snapshot = await transferHost({
      channelId,
      fromUserId: req.userId!,
      toUserId,
    });
    res.json(ok({ activity: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/presence
 * Body: { kind: ActivityKind | null }
 *
 * Update the caller's per-user activity presence. Used to declare "I just
 * joined Notes" / "I left the activity" — broadcasts via voice presence so
 * every other voice participant can render the in-progress overlay.
 *
 * If the caller is host of a host-led activity and they declare a different
 * kind (or null), the server doc is auto-stopped — see
 * `setActivityPresence`. So the same endpoint handles both "I left" and
 * "the host ended this for everyone".
 */
voiceActivityRouter.post('/:channelId/activity/presence', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const { kind } = setPresenceBody.parse(req.body);
    await setActivityPresence({ channelId, userId: req.userId!, kind });
    res.json(ok({ ok: true } as const));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/quiz
 * Host-only. Pin a quiz for the active quiz activity.
 */
voiceActivityRouter.post('/:channelId/activity/quiz', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = channelIdParam.parse(req.params);
    const body = pinQuizBody.parse(req.body);
    const snapshot = await pinQuiz({ channelId, userId: req.userId!, body });
    res.json(ok({ activity: snapshot }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /channels/:channelId/activity/pomodoro
 * Pomodoro control surface. Discriminated by `action`:
 *  - `pause` / `resume` / `skip` → host-only
 *  - `requestReset`              → any participant
 *  - `respondReset { accept }`   → host-only
 */
voiceActivityRouter.post(
  '/:channelId/activity/pomodoro',
  requireAuth,
  async (req, res, next) => {
    try {
      const { channelId } = channelIdParam.parse(req.params);
      const command = pomodoroControlBody.parse(req.body);
      const snapshot = await applyPomodoroControl({
        channelId,
        userId: req.userId!,
        command,
      });
      res.json(ok({ activity: snapshot }));
    } catch (err) {
      next(err);
    }
  },
);
