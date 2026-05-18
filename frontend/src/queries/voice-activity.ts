import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  api,
  getSocket,
  type ActivityKind,
  type VoiceActivitySnapshot,
  type WatchSourceKind,
} from '@/queries/client';
import { qk } from '@/queries/keys';

interface ActivityEnvelope {
  activity: VoiceActivitySnapshot | null;
}

/**
 * Start-activity input is a discriminated union — matches the backend Zod
 * schema. The kind decides which extra fields the caller must supply.
 */
export type StartActivityInput =
  | {
      channelId: string;
      kind: 'youtube' | 'screen-share';
      source: { kind: WatchSourceKind; url: string; title?: string | null };
    }
  | {
      channelId: string;
      kind: 'notes' | 'whiteboard';
    }
  | {
      channelId: string;
      kind: 'quiz';
      quizId?: string | null;
    }
  | {
      channelId: string;
      kind: 'pomodoro';
      totalRounds?: number;
    };

/**
 * Pomodoro control input — mirrors the backend's discriminated union.
 * `pause` / `resume` / `skip` are host-only. `requestReset` can be sent
 * by any participant. `respondReset` is host-only and replies to a
 * pending reset request.
 */
export type PomodoroControlInput =
  | { channelId: string; action: 'pause' | 'resume' | 'skip' | 'requestReset' }
  | { channelId: string; action: 'respondReset'; accept: boolean };

interface ControlInput {
  channelId: string;
  action: 'play' | 'pause' | 'seek';
  timeMs: number;
}

interface PinQuizInput {
  channelId: string;
  quizId: string | null;
}

interface SetPresenceInput {
  channelId: string;
  kind: ActivityKind | null;
}

/**
 * Reads the current voice activity for a channel, then subscribes to the
 * Socket.IO `channel:<id>:activity` room. Every server-side state change
 * (start, control, host-transfer, stop) writes straight into the cache so
 * every participant projects the same UI without polling.
 */
export function useVoiceActivity(
  channelId: string | undefined,
): UseQueryResult<VoiceActivitySnapshot | null> {
  const qc = useQueryClient();
  const key = channelId ? qk.voiceActivity.byChannel(channelId) : qk.voiceActivity.root;

  const query = useQuery<VoiceActivitySnapshot | null>({
    queryKey: key,
    queryFn: async () => {
      const result = await api<ActivityEnvelope>(`/channels/${channelId}/activity`);
      return result.activity;
    },
    enabled: Boolean(channelId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();

    const handle = (change: { channelId: string; snapshot: VoiceActivitySnapshot | null }) => {
      if (change.channelId !== channelId) return;
      qc.setQueryData<VoiceActivitySnapshot | null>(
        qk.voiceActivity.byChannel(channelId),
        change.snapshot,
      );
    };

    socket.emit('voice:subscribe_activity', channelId, () => {
      // ack ignored — gateway only rejects malformed ids
    });
    socket.on('voice:activity_changed', handle);

    return () => {
      socket.off('voice:activity_changed', handle);
      socket.emit('voice:unsubscribe_activity', channelId);
    };
  }, [channelId, qc]);

  return query;
}

function startBody(input: StartActivityInput): Record<string, unknown> {
  if (input.kind === 'youtube' || input.kind === 'screen-share') {
    return { kind: input.kind, source: input.source };
  }
  if (input.kind === 'quiz') {
    return { kind: 'quiz', quizId: input.quizId ?? null };
  }
  if (input.kind === 'pomodoro') {
    return input.totalRounds != null
      ? { kind: 'pomodoro', totalRounds: input.totalRounds }
      : { kind: 'pomodoro' };
  }
  return { kind: input.kind };
}

function pomodoroControlBody(input: PomodoroControlInput): Record<string, unknown> {
  if (input.action === 'respondReset') {
    return { action: 'respondReset', accept: input.accept };
  }
  return { action: input.action };
}

export function useStartActivity(): UseMutationResult<
  VoiceActivitySnapshot,
  Error,
  StartActivityInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const result = await api<ActivityEnvelope>(`/channels/${input.channelId}/activity/start`, {
        method: 'POST',
        body: startBody(input),
      });
      if (!result.activity) throw new Error('Server did not return an activity snapshot');
      return result.activity;
    },
    onSuccess: (activity) => {
      qc.setQueryData<VoiceActivitySnapshot | null>(
        qk.voiceActivity.byChannel(activity.channelId),
        activity,
      );
    },
  });
}

export function useStopActivity(): UseMutationResult<boolean, Error, { channelId: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId }) => {
      const result = await api<{ stopped: boolean }>(`/channels/${channelId}/activity/stop`, {
        method: 'POST',
      });
      return result.stopped;
    },
    onSuccess: (_stopped, { channelId }) => {
      qc.setQueryData<VoiceActivitySnapshot | null>(qk.voiceActivity.byChannel(channelId), null);
    },
  });
}

export function useActivityControl(): UseMutationResult<
  VoiceActivitySnapshot,
  Error,
  ControlInput
> {
  return useMutation({
    mutationFn: async ({ channelId, action, timeMs }) => {
      const result = await api<ActivityEnvelope>(`/channels/${channelId}/activity/control`, {
        method: 'POST',
        body: { action, timeMs },
      });
      if (!result.activity) throw new Error('Server did not return an activity snapshot');
      return result.activity;
    },
  });
}

/**
 * Pomodoro control mutation. Covers the full surface (pause / resume /
 * skip / requestReset / respondReset). Snapshot updates ride the same
 * Socket.IO `voice:activity_changed` event, so we don't need to wire
 * setQueryData here — it'll arrive on the realtime channel.
 */
export function usePomodoroControl(): UseMutationResult<
  VoiceActivitySnapshot,
  Error,
  PomodoroControlInput
> {
  return useMutation({
    mutationFn: async (input) => {
      const result = await api<ActivityEnvelope>(`/channels/${input.channelId}/activity/pomodoro`, {
        method: 'POST',
        body: pomodoroControlBody(input),
      });
      if (!result.activity) throw new Error('Server did not return an activity snapshot');
      return result.activity;
    },
  });
}

export function useTransferActivityHost(): UseMutationResult<
  VoiceActivitySnapshot,
  Error,
  { channelId: string; toUserId: string }
> {
  return useMutation({
    mutationFn: async ({ channelId, toUserId }) => {
      const result = await api<ActivityEnvelope>(`/channels/${channelId}/activity/host`, {
        method: 'POST',
        body: { toUserId },
      });
      if (!result.activity) throw new Error('Server did not return an activity snapshot');
      return result.activity;
    },
  });
}

export function usePinQuiz(): UseMutationResult<VoiceActivitySnapshot, Error, PinQuizInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, quizId }) => {
      const result = await api<ActivityEnvelope>(`/channels/${channelId}/activity/quiz`, {
        method: 'POST',
        body: { quizId },
      });
      if (!result.activity) throw new Error('Server did not return an activity snapshot');
      return result.activity;
    },
    onSuccess: (activity) => {
      qc.setQueryData<VoiceActivitySnapshot | null>(
        qk.voiceActivity.byChannel(activity.channelId),
        activity,
      );
    },
  });
}

/**
 * Declare the local user's per-user activity presence: "I just joined X" or
 * "I left my activity (kind=null)". The server side-effects to broadcast
 * this on the voice presence channel so other participants see the overlay
 * card. Idempotent: re-posting the same kind is a no-op server-side.
 */
export function useSetActivityPresence(): UseMutationResult<void, Error, SetPresenceInput> {
  return useMutation({
    mutationFn: async ({ channelId, kind }) => {
      await api<{ ok: true }>(`/channels/${channelId}/activity/presence`, {
        method: 'POST',
        body: { kind },
      });
    },
  });
}

/**
 * Compatibility helper for `ActivityKind` → display copy lookups, e.g.
 * toast strings. The registry owns rich metadata; this is just the slug.
 */
export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'youtube',
  'screen-share',
  'notes',
  'whiteboard',
  'quiz',
] as const;
