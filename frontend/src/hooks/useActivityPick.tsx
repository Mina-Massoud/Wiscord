import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { findActivity, type ActivityDefinition } from '@/components/activity/ActivityRegistry';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVoiceSessionStore, useVoiceHome } from '@/lib/voice-session-store';
import { toast } from '@/lib/toast';
import { ApiError, type ActivityKind } from '@/queries/client';
import { useMyProfile } from '@/queries/profile';
import {
  useSetActivityPresence,
  useStartActivity,
  useVoiceActivity,
} from '@/queries/voice-activity';

const HOST_LED_KINDS: ReadonlySet<ActivityKind> = new Set(['youtube', 'screen-share', 'quiz']);

/**
 * Centralised activity-switch flow. Used by every surface that lets
 * the user pick an activity (the chunky launcher button, the
 * VoiceControlBar dropdown, the "join existing activity" overlay).
 *
 * Two responsibilities:
 *
 *   1. **Guard the switch.** If the user is currently in an activity
 *      and picks a different one, surface a confirm dialog before
 *      tearing down the old one. The previous flow let the host of a
 *      live quiz silently bounce to the voice grid the moment they
 *      tapped another activity — easy to do by accident, no undo.
 *
 *   2. **Apply the pick.** Atomically sets `myActivityKind`, posts
 *      presence, fires the start mutation for host-led kinds that
 *      need it (Quiz), and navigates to the voice route if we're
 *      somewhere else in the app. The page then renders the embed
 *      for the new kind directly — no detour through the empty grid.
 *
 * Consumers render `{confirmDialog}` somewhere in their tree and
 * call `pickActivity(def)` from their click handlers.
 */
interface UseActivityPickResult {
  pickActivity: (definition: ActivityDefinition) => void;
  /**
   * Join an activity that someone else is already hosting (or a lab
   * kind that's just open). Same confirm-then-apply semantics, but
   * skips the host-conflict check and the start mutation since we're
   * not the one running it.
   */
  joinExistingActivity: (kind: ActivityKind) => void;
  confirmDialog: React.ReactNode;
}

export function useActivityPick(): UseActivityPickResult {
  const channelId = useVoiceSessionStore((s) => s.channelId);
  const voiceHome = useVoiceHome();
  const myActivityKind = useVoiceSessionStore((s) => s.myActivityKind);
  const activityQuery = useVoiceActivity(channelId ?? undefined);
  const activity = activityQuery.data ?? null;
  const me = useMyProfile().data;
  const navigate = useNavigate();
  const location = useLocation();
  const presence = useSetActivityPresence();
  const startMutation = useStartActivity();

  const [pendingPick, setPendingPick] = useState<{
    kind: 'pick' | 'join';
    definition: ActivityDefinition;
  } | null>(null);

  const postPresence = useCallback(
    (kind: ActivityKind | null): void => {
      if (!channelId) return;
      presence.mutate({ channelId, kind }, { onError: () => undefined });
    },
    [channelId, presence],
  );

  const navigateToVoice = useCallback((): void => {
    if (!channelId) return;
    // The channel's home route — set at join time — is where the activity
    // surface lives. Falls back to the labs route only if a session somehow
    // has no recorded home (defensive; every join path sets one).
    const target = voiceHome ?? `/app/labs/voice/${channelId}`;
    if (location.pathname === target) return;
    void navigate(target);
  }, [channelId, voiceHome, location.pathname, navigate]);

  const applyPick = useCallback(
    (definition: ActivityDefinition): void => {
      if (!channelId) return;
      const kind = definition.kind;

      // Host-conflict pre-check for host-led kinds. We block instead
      // of silently replacing — explicit + safe. The user can join
      // the existing session via the overlay card if they want.
      if (HOST_LED_KINDS.has(kind) && activity && activity.hostUserId !== me?.id) {
        const existing = findActivity(activity.kind);
        toast.info(
          existing
            ? `Someone's already running ${existing.title} here — slide into their session from the voice grid.`
            : 'Another activity is already poppin in here.',
        );
        return;
      }

      useVoiceSessionStore.getState().setActivityKind(kind);
      postPresence(kind);
      navigateToVoice();

      if (!HOST_LED_KINDS.has(kind)) return;

      // Quiz starts with quizId=null so participants land in the picker.
      // Watch kinds (`youtube`, `screen-share`) need a source first —
      // their embed renders a source picker and fires `start` from it.
      if (kind === 'quiz' && (!activity || activity.hostUserId === me?.id)) {
        startMutation.mutate(
          { channelId, kind: 'quiz', quizId: null },
          {
            onError: (err) => {
              useVoiceSessionStore.getState().setActivityKind(null);
              postPresence(null);
              if (err instanceof ApiError && err.code === 'activity_conflict') {
                toast.info(err.message);
              } else {
                toast.error(err.message || "Couldn't start the quiz — try again?");
              }
            },
          },
        );
      }
    },
    [activity, channelId, me?.id, navigateToVoice, postPresence, startMutation],
  );

  const applyJoin = useCallback(
    (definition: ActivityDefinition): void => {
      if (!channelId) return;
      useVoiceSessionStore.getState().setActivityKind(definition.kind);
      postPresence(definition.kind);
      navigateToVoice();
    },
    [channelId, navigateToVoice, postPresence],
  );

  const pickActivity = useCallback(
    (definition: ActivityDefinition): void => {
      if (!channelId) return;
      if (definition.kind === myActivityKind) return;
      if (myActivityKind !== null) {
        setPendingPick({ kind: 'pick', definition });
        return;
      }
      applyPick(definition);
    },
    [applyPick, channelId, myActivityKind],
  );

  const joinExistingActivity = useCallback(
    (kind: ActivityKind): void => {
      if (!channelId) return;
      if (kind === myActivityKind) return;
      const def = findActivity(kind);
      if (!def) return;
      if (myActivityKind !== null) {
        setPendingPick({ kind: 'join', definition: def });
        return;
      }
      applyJoin(def);
    },
    [applyJoin, channelId, myActivityKind],
  );

  const confirmDialog = (
    <SwitchActivityConfirmDialog
      pending={pendingPick}
      currentKind={myActivityKind}
      onCancel={() => setPendingPick(null)}
      onConfirm={() => {
        if (!pendingPick) return;
        const { kind, definition } = pendingPick;
        setPendingPick(null);
        if (kind === 'pick') applyPick(definition);
        else applyJoin(definition);
      }}
    />
  );

  return { pickActivity, joinExistingActivity, confirmDialog };
}

interface SwitchActivityConfirmDialogProps {
  pending: { kind: 'pick' | 'join'; definition: ActivityDefinition } | null;
  currentKind: ActivityKind | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function SwitchActivityConfirmDialog({
  pending,
  currentKind,
  onCancel,
  onConfirm,
}: SwitchActivityConfirmDialogProps): React.JSX.Element {
  const currentDef = currentKind ? findActivity(currentKind) : null;
  const currentTitle = currentDef?.title ?? 'what you have open';
  const nextTitle = pending?.definition.title ?? 'something else';

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-glass-surface-2 border-glass-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-ink text-subhead">Switching it up?</DialogTitle>
          <DialogDescription className="text-ink-muted text-control">
            You&apos;ll dip from <span className="text-ink font-semibold">{currentTitle}</span> and
            slide into <span className="text-ink font-semibold">{nextTitle}</span>. Anyone
            you&apos;re hosting bounces with you.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Nah, stay
          </Button>
          <Button type="button" onClick={onConfirm}>
            Bet, switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
