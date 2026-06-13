import {
  Calendar,
  ExternalLink,
  Mic2,
  MoreVertical,
  Trash2,
  Users,
  Volume2,
  Pencil,
} from 'lucide-react';
import type { EventWithMeta, EventType } from '@/types/event';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUpsertRsvp } from '@/queries/events';

// ─── Color palette for event accent stripes ──────────────────────────────────

const DEFAULT_COVER_COLORS: Record<EventType, string> = {
  voice_channel: '#5865F2',
  stage_channel: '#EB459E',
  external: '#57F287',
};

function EventTypeIcon({ type }: { type: EventType }): React.JSX.Element {
  if (type === 'stage_channel') return <Mic2 className="size-3" aria-hidden />;
  if (type === 'external') return <ExternalLink className="size-3" aria-hidden />;
  return <Volume2 className="size-3" aria-hidden />;
}

function EventTypeBadge({ type }: { type: EventType }): React.JSX.Element {
  const label =
    type === 'voice_channel' ? 'Voice' : type === 'stage_channel' ? 'Stage' : 'External';
  return (
    <Badge
      variant="secondary"
      className="bg-glass-surface-1 border-glass-border text-ink-muted text-badge flex items-center gap-1 px-2 py-0.5 font-medium"
    >
      <EventTypeIcon type={type} />
      {label}
    </Badge>
  );
}

function formatEventTime(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  const startStr = new Intl.DateTimeFormat(undefined, opts).format(start);
  if (!endsAt) return startStr;
  const end = new Date(endsAt);
  const endStr = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    end,
  );
  return `${startStr} – ${endStr}`;
}

function getJoinHref(event: EventWithMeta): string | null {
  if (event.type === 'external') return event.externalLink;
  // In-app channel link
  if (event.channelId) return `/app/servers/${event.serverId}/channels/${event.channelId}`;
  return null;
}

interface EventCardProps {
  event: EventWithMeta;
  serverId: string;
  currentUserId: string | undefined;
  serverOwnerId: string | undefined;
  onEdit: (event: EventWithMeta) => void;
  onDelete: (event: EventWithMeta) => void;
}

export function EventCard({
  event,
  serverId,
  currentUserId,
  serverOwnerId,
  onEdit,
  onDelete,
}: EventCardProps): React.JSX.Element {
  const upsertRsvp = useUpsertRsvp(serverId);
  const isPast = new Date(event.startsAt) < new Date();
  const accentColor = event.coverColor ?? DEFAULT_COVER_COLORS[event.type];
  const canEdit = currentUserId === event.creatorId || currentUserId === serverOwnerId;
  const joinHref = getJoinHref(event);

  function handleRsvp(status: 'going' | 'interested'): void {
    upsertRsvp.mutate({ eventId: event.id, status });
  }

  return (
    <article
      className="group border-glass-border bg-glass-surface-1 duration-base hover:border-glass-border-strong relative flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-lg"
      aria-label={event.title}
    >
      {/* Accent stripe */}
      <div
        className="duration-base h-1.5 w-full shrink-0 transition-all group-hover:h-2"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      />

      <div className="flex flex-col gap-3 p-4">
        {/* Header row: type badge + actions menu */}
        <div className="flex items-start justify-between gap-2">
          <EventTypeBadge type={event.type} />
          <div className="flex items-center gap-1.5">
            {isPast && (
              <Badge variant="outline" className="border-glass-border text-ink-subtle text-badge">
                Past
              </Badge>
            )}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-ink-muted hover:text-ink size-7 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Event options"
                    id={`event-menu-${event.id}`}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => onEdit(event)}
                    className="gap-2"
                    id={`event-edit-${event.id}`}
                  >
                    <Pencil className="size-4" />
                    Edit event
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(event)}
                    className="text-destructive focus:text-destructive gap-2"
                    id={`event-delete-${event.id}`}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-body text-ink line-clamp-2 leading-tight font-semibold">
            {event.title}
          </h3>
          {event.description && (
            <p className="text-caption text-ink-muted mt-1 line-clamp-2">{event.description}</p>
          )}
        </div>

        {/* Time */}
        <div className="text-caption text-ink-muted flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0" aria-hidden />
          <span>{formatEventTime(event.startsAt, event.endsAt)}</span>
        </div>

        {/* Creator */}
        <div className="flex items-center gap-1.5">
          <Avatar className="size-5">
            <AvatarImage src={event.creator.avatarUrl ?? undefined} />
            <AvatarFallback className="text-badge bg-glass-surface-1">
              {event.creator.displayName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-caption text-ink-muted">
            by <span className="text-ink font-medium">{event.creator.displayName}</span>
          </span>
        </div>

        {/* RSVP counts */}
        <div className="text-caption text-ink-muted flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            <span>
              <span className="text-ink font-semibold">{event.goingCount}</span> Going
            </span>
          </span>
          <span className="text-glass-border">·</span>
          <span>
            <span className="text-ink font-semibold">{event.interestedCount}</span> Interested
          </span>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 pt-1">
          {/* Going button. Inactive state uses surface-2 (darker than the
              surface-1 card) + a stronger border so it reads as a button
              instead of blending into the card. */}
          <Button
            size="sm"
            variant={event.myRsvp === 'going' ? 'default' : 'secondary'}
            className={
              event.myRsvp === 'going'
                ? 'bg-blurple hover:bg-blurple/90 flex-1 text-white'
                : 'bg-glass-surface-2 border-glass-border-strong text-ink hover:bg-glass-hover flex-1'
            }
            onClick={() => handleRsvp('going')}
            disabled={upsertRsvp.isPending || isPast}
            id={`rsvp-going-${event.id}`}
            aria-pressed={event.myRsvp === 'going'}
          >
            {event.myRsvp === 'going' ? '✓ Going' : 'Going'}
          </Button>

          {/* Interested button */}
          <Button
            size="sm"
            variant={event.myRsvp === 'interested' ? 'default' : 'secondary'}
            className={
              event.myRsvp === 'interested'
                ? 'bg-blurple/15 border-blurple/50 text-blurple hover:bg-blurple/20 flex-1'
                : 'bg-glass-surface-2 border-glass-border-strong text-ink-muted hover:text-ink hover:bg-glass-hover flex-1'
            }
            onClick={() => handleRsvp('interested')}
            disabled={upsertRsvp.isPending || isPast}
            id={`rsvp-interested-${event.id}`}
            aria-pressed={event.myRsvp === 'interested'}
          >
            {event.myRsvp === 'interested' ? '★ Interested' : '☆ Interested'}
          </Button>

          {/* Join / Access button */}
          {joinHref && !isPast && (
            <Button
              size="sm"
              variant="ghost"
              className="text-ink-muted hover:text-ink shrink-0"
              asChild
              id={`event-join-${event.id}`}
            >
              <a
                href={joinHref}
                target={event.type === 'external' ? '_blank' : undefined}
                rel={event.type === 'external' ? 'noopener noreferrer' : undefined}
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
