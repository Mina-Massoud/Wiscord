import { useState } from 'react';
import { Calendar, Plus, RefreshCw, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useServerEvents, useDeleteEvent } from '@/queries/events';
import { useServer } from '@/queries/servers';
import { useSession } from '@/queries/auth';
import { toast } from '@/lib/toast';
import { EventForm } from './EventForm';
import { EventList } from './EventList';
import type { EventWithMeta } from '@/types/event';

interface EventsViewProps {
  serverId: string;
}

export function EventsView({ serverId }: EventsViewProps): React.JSX.Element {
  const [formOpen, setFormOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<EventWithMeta | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventWithMeta | undefined>(undefined);

  // Queries
  const eventsQuery = useServerEvents(serverId);
  const serverQuery = useServer(serverId);
  const sessionQuery = useSession();

  // Mutation
  const deleteEvent = useDeleteEvent(serverId);

  const currentUserId = sessionQuery.data?.id;
  const serverOwnerId = serverQuery.data?.ownerId;

  const handleCreateClick = (): void => {
    setEventToEdit(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (event: EventWithMeta): void => {
    setEventToEdit(event);
    setFormOpen(true);
  };

  const handleDeleteClick = (event: EventWithMeta): void => {
    setEventToDelete(event);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = (): void => {
    if (!eventToDelete) return;
    deleteEvent.mutate(eventToDelete.id, {
      onSuccess: () => {
        toast.success(`Deleted event: "${eventToDelete.title}"`);
        setDeleteOpen(false);
        setEventToDelete(undefined);
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete event.');
      },
    });
  };

  if (eventsQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between border-b border-glass-border pb-6">
          <div className="flex flex-col gap-2">
            <div className="bg-glass-surface-1 h-8 w-48 animate-pulse rounded-md" />
            <div className="bg-glass-surface-1 h-4 w-72 animate-pulse rounded-md" />
          </div>
          <div className="bg-glass-surface-1 h-10 w-32 animate-pulse rounded-md" />
        </div>
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-glass-border bg-glass-surface-1 flex h-48 flex-col justify-between rounded-xl border p-4 animate-pulse"
            >
              <div className="flex flex-col gap-3">
                <div className="h-4 w-16 rounded bg-glass-surface-2" />
                <div className="h-6 w-full rounded bg-glass-surface-2" />
                <div className="h-4 w-2/3 rounded bg-glass-surface-2" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded bg-glass-surface-2" />
                <div className="h-8 flex-1 rounded bg-glass-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (eventsQuery.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="bg-destructive/10 border-destructive/20 flex size-12 items-center justify-center rounded-2xl border text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <p className="text-ink text-body font-semibold">Couldn't load server events.</p>
        <p className="text-ink-muted text-caption max-w-sm -mt-2">
          An error occurred while fetching the event list. Please check your internet connection or server status.
        </p>
        <Button variant="secondary" onClick={() => void eventsQuery.refetch()} className="gap-2">
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    );
  }

  const eventsList = eventsQuery.data ?? [];

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        {/* View Header */}
        <header className="flex flex-col gap-4 border-b border-glass-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-blurple/10 border-blurple/20 flex size-10 items-center justify-center rounded-xl border text-blurple shrink-0">
              <Calendar className="size-5" />
            </div>
            <div>
              <h1 className="text-body font-bold text-ink leading-snug">Events</h1>
              <p className="text-caption text-ink-muted mt-0.5">
                Join voice hangouts, gaming nights, or group discussions scheduled in this server.
              </p>
            </div>
          </div>
          <Button onClick={handleCreateClick} className="gap-1.5 self-start sm:self-center">
            <Plus className="size-4" />
            Create Event
          </Button>
        </header>

        {/* Event List / Grid */}
        <EventList
          events={eventsList}
          serverId={serverId}
          currentUserId={currentUserId}
          serverOwnerId={serverOwnerId}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      </div>

      {/* Create / Edit Dialog */}
      <EventForm
        serverId={serverId}
        open={formOpen}
        onOpenChange={setFormOpen}
        eventToEdit={eventToEdit}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-glass-border bg-canvas text-ink max-w-md">
          <DialogTitle className="text-lg font-bold">Delete Event</DialogTitle>
          <DialogDescription className="text-ink-muted text-control mt-2">
            Are you sure you want to delete the event <span className="font-semibold text-ink">"{eventToDelete?.title}"</span>? This will permanently cancel it and remove all attendee RSVPs. This action cannot be undone.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteEvent.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteEvent.isPending}
            >
              {deleteEvent.isPending ? (
                <>
                  <RefreshCw className="size-4 animate-spin" aria-hidden />
                  Deleting...
                </>
              ) : (
                'Delete Event'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
