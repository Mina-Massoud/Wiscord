import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { Loader2, LogIn, PhoneOff, Wifi } from 'lucide-react';
import { type ActivityDefinition } from '@/components/activity/ActivityRegistry';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useCopy } from '@/lib/copy/useCopy';

import { VoiceMicStatusButton } from './VoiceMicStatusButton';
import { VoiceChunkyRow } from './VoiceStatusRowVoiceChunkyRow';

interface VoiceStatusRowProps {
  /**
   * The slugified channel label (last six chars of channelId, etc).
   * Shown as a subtitle under the connection state title.
   */
  channelSlug: string;
  /**
   * "Jump to this voice channel" affordance — shown only when the user
   * is NOT currently on the voice channel's route.
   */
  onJump?: () => void;
  /**
   * Wires the activity launcher dialog and the screen-share shortcut.
   * Receives the picked activity definition; the caller decides what
   * to do (start a server doc, navigate, etc).
   */
  onActivitySelect?: (activity: ActivityDefinition) => void;
}

/**
 * Discord-style "Voice Connected" status card used in the bottom-left
 * user panel on every authed page. Composed of two sections:
 *
 *   1. Top row — signal icon, "Voice Connected" + channel slug, plus
 *      corner actions (mic settings, jump-to-channel, hang up).
 *   2. Chunky 4-button grid — Pomodoro, Share screen, Activities,
 *      Soundboard. The first opens the dynamic island in pomodoro
 *      mode; the middle two route through `onActivitySelect`; the
 *      last is a placeholder kept visible so the row matches Discord.
 *
 * Renders inside `<LiveKitRoom>` for the mic + disconnect hooks.
 */
export function VoiceStatusRow({
  channelSlug,
  onJump,
  onActivitySelect,
}: VoiceStatusRowProps): React.JSX.Element {
  const state = useConnectionState();
  const room = useRoomContext();
  const t = useCopy();

  const isConnected = state === ConnectionState.Connected;
  const isReconnecting = state === ConnectionState.Reconnecting;

  const title = isConnected
    ? t('voicePanel.connected.title')
    : isReconnecting
      ? t('voicePanel.reconnecting.title')
      : t('voicePanel.connecting.title');

  const titleColorClass = isConnected ? 'text-success' : 'text-blurple';
  const iconBgClass = isConnected ? 'bg-success/15' : 'bg-blurple/15';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-3 pt-3">
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', iconBgClass)}
          aria-hidden
        >
          {isConnected ? (
            <Wifi className="text-success size-5" />
          ) : (
            <Loader2 className="text-blurple size-5 animate-spin" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn('text-control leading-tight font-semibold', titleColorClass)}
            aria-live="polite"
          >
            {title}
          </span>
          {onJump ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={onJump}
              aria-label={`Jump to ${channelSlug}`}
              className="text-ink-muted text-caption hover:text-ink h-auto max-w-full justify-start truncate p-0 leading-tight font-normal"
            >
              {channelSlug}
            </Button>
          ) : (
            <span className="text-ink-muted text-caption truncate leading-tight">
              {channelSlug}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {isConnected ? <VoiceMicStatusButton /> : null}

          {onJump ? (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onJump}
                  aria-label="Jump to voice channel"
                  className="text-ink-muted hover:bg-glass-hover hover:text-ink focus-visible:ring-blurple flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <LogIn className="size-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Jump to channel
              </TooltipContent>
            </Tooltip>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void room.disconnect();
            }}
            aria-label={isConnected ? 'Disconnect from voice' : 'Cancel join'}
            className="text-ink-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <PhoneOff className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {isConnected ? <VoiceChunkyRow onActivitySelect={onActivitySelect} /> : null}
    </div>
  );
}
