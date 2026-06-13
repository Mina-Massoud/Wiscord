import { useCallback, useEffect, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X, Volume2, Mic2, ExternalLink, CalendarPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/lib/toast';
import { useCreateEvent, useUpdateEvent } from '@/queries/events';
import {
  useCreateEvent as useCreateCalendarEvent,
  useCalendarCategories,
} from '@/queries/calendar';
import { useServerChannels } from '@/queries/channels';
import { useSession } from '@/queries/auth';
import type { EventWithMeta, EventType } from '@/types/event';
import { eventFormSchema, toDatetimeLocal, type EventFormValues } from './Eventformschema';
import { EventColorPicker } from './EventColorPicker';

// Shared section-label style for every field in the form — small,
// uppercase, wide-tracked. Kept in one place so the rhythm stays
// consistent and the className isn't repeated on every FormLabel.
const FIELD_LABEL = 'text-ink-subtle text-badge font-semibold tracking-wider uppercase';

interface EventFormProps {
  serverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventToEdit?: EventWithMeta;
}

export function EventForm({
  serverId,
  open,
  onOpenChange,
  eventToEdit,
}: EventFormProps): React.JSX.Element {
  const titleId = useId();
  const createEvent = useCreateEvent(serverId);
  const updateEvent = useUpdateEvent(serverId);
  const createCalendarEvent = useCreateCalendarEvent();
  const sessionQuery = useSession();

  const channelsQuery = useServerChannels(serverId);
  // useMemo keeps the array reference stable — a bare .filter() returns a new ref
  // every render, making resetForm's useCallback recreate on every tick, which
  // fires the useEffect → form.reset() → re-render → infinite loop.
  const voiceChannels = useMemo(
    () => (channelsQuery.data ?? []).filter((c) => c.type === 'voice'),
    [channelsQuery.data],
  );

  const calendarCategoriesQuery = useCalendarCategories({
    scope: 'user',
    ownerId: sessionQuery.data?.id ?? null,
  });
  // Same issue: ?? [] would return a fresh [] on every render when data is undefined.
  const calendarCategories = useMemo(
    () => calendarCategoriesQuery.data ?? [],
    [calendarCategoriesQuery.data],
  );

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'voice_channel',
      channelId: null,
      externalLink: '',
      startsAt: '',
      endsAt: '',
      coverColor: '#5865F2',
      addToCalendar: true,
    },
  });

  const watchedType = form.watch('type');
  const watchedColor = form.watch('coverColor') || '#5865F2';
  const isPending = form.formState.isSubmitting || createEvent.isPending || updateEvent.isPending;

  const resetForm = useCallback((): void => {
    if (eventToEdit) {
      form.reset({
        title: eventToEdit.title,
        description: eventToEdit.description ?? '',
        type: eventToEdit.type,
        channelId: eventToEdit.channelId ?? null,
        externalLink: eventToEdit.externalLink ?? '',
        startsAt: toDatetimeLocal(eventToEdit.startsAt),
        endsAt: toDatetimeLocal(eventToEdit.endsAt),
        coverColor: eventToEdit.coverColor ?? '#5865F2',
        addToCalendar: false,
      });
    } else {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      form.reset({
        title: '',
        description: '',
        type: 'voice_channel',
        channelId: voiceChannels[0]?.id ?? null,
        externalLink: '',
        startsAt: toDatetimeLocal(now.toISOString()),
        endsAt: '',
        coverColor: '#5865F2',
        addToCalendar: true,
      });
    }
  }, [form, eventToEdit, voiceChannels]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      form.reset();
    }
    onOpenChange(next);
  };

  function onSubmit(values: EventFormValues): void {
    const payloadStartsAt = new Date(values.startsAt).toISOString();
    const payloadEndsAt = values.endsAt
      ? new Date(values.endsAt).toISOString()
      : new Date(new Date(values.startsAt).getTime() + 60 * 60 * 1000).toISOString();

    const dto = {
      title: values.title.trim(),
      description: values.description?.trim() || null,
      type: values.type,
      channelId: values.type !== 'external' ? values.channelId : null,
      externalLink: values.type === 'external' ? values.externalLink?.trim() : null,
      startsAt: payloadStartsAt,
      endsAt: values.endsAt ? payloadEndsAt : null,
      coverColor: values.coverColor,
    };

    if (eventToEdit) {
      updateEvent.mutate(
        { eventId: eventToEdit.id, patch: dto },
        {
          onSuccess: () => {
            toast.success(`Updated event: "${dto.title}"`);
            handleOpenChange(false);
          },
          onError: (err) => {
            toast.error(err.message || 'Failed to update event.');
          },
        },
      );
      return;
    }

    createEvent.mutate(dto, {
      onSuccess: () => {
        toast.success(`Created event: "${dto.title}"`);

        if (values.addToCalendar && calendarCategories.length > 0) {
          createCalendarEvent.mutate(
            {
              channelId: null,
              categoryId: calendarCategories[0].id,
              title: dto.title,
              description: dto.description ?? '',
              startAt: payloadStartsAt,
              endAt: payloadEndsAt,
              allDay: false,
              recurrence: { freq: 'none', count: 1 },
            },
            {
              onSuccess: () => {
                toast.success('Also added to your personal calendar ✓', {
                  description: 'Find it at /app/calendar',
                });
              },
              onError: () => {
                toast.error("Event created, but couldn't sync to your calendar. Add it manually.");
              },
            },
          );
        }

        handleOpenChange(false);
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to create event.');
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideClose className="bg-canvas gap-0 overflow-hidden border-0 p-0 sm:max-w-lg">
        <div className="relative">
          <div className="absolute top-4 right-4 z-10 flex flex-col items-center">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
              className="border-glass-border text-ink-muted hover:text-ink hover:border-ink-muted flex size-9 items-center justify-center rounded-full border-2 transition-colors"
            >
              <X className="size-4" />
            </button>
            <span className="text-ink-subtle text-badge mt-1 font-bold tracking-wider">ESC</span>
          </div>

          <div className="max-h-[85vh] overflow-y-auto px-8 py-8">
            <DialogTitle asChild>
              <h2 className="text-ink text-title">
                {eventToEdit ? 'Edit server event' : 'Create server event'}
              </h2>
            </DialogTitle>
            <p className="text-ink-muted text-control mt-1.5 max-w-prose">
              Gather your community for a focused hangout, study session, or voice channel chat.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-5">
                {/* Add to Calendar toggle — create mode only */}
                {!eventToEdit && (
                  <FormField
                    control={form.control}
                    name="addToCalendar"
                    render={({ field }) => (
                      <FormItem className="border-blurple/20 bg-blurple/5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-blurple/10 text-blurple flex size-8 items-center justify-center rounded-lg">
                            <CalendarPlus className="size-4" />
                          </div>
                          <div>
                            <FormLabel className="text-ink cursor-pointer font-medium">
                              Add to my calendar
                            </FormLabel>
                            <p className="text-ink-muted text-caption mt-0.5">
                              Mirror this event to your personal study planner
                            </p>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isPending}
                            aria-label="Add to my calendar"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {/* Theme color picker */}
                <EventColorPicker
                  value={watchedColor}
                  onChange={(color) => form.setValue('coverColor', color)}
                />

                {/* Event Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-3 space-y-0">
                      <FormLabel className={FIELD_LABEL}>Event Title</FormLabel>
                      <FormControl>
                        <Input
                          id={titleId}
                          {...field}
                          placeholder="Study Night, Gaming, Project Review..."
                          maxLength={100}
                          autoComplete="off"
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-3 space-y-0">
                      <FormLabel className={FIELD_LABEL}>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          placeholder="What is this event about? (optional)"
                          maxLength={2000}
                          rows={3}
                          disabled={isPending}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Event Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-3 space-y-0">
                      <FormLabel className={FIELD_LABEL}>Event Type</FormLabel>
                      <Select
                        disabled={isPending}
                        onValueChange={(v: EventType) => {
                          field.onChange(v);
                          form.setValue(
                            'channelId',
                            v !== 'external' && voiceChannels.length > 0
                              ? voiceChannels[0].id
                              : null,
                          );
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-glass-surface-1 text-ink w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="voice_channel">
                            <span className="flex items-center gap-2">
                              <Volume2 className="text-ink-muted size-4" />
                              Voice Channel
                            </span>
                          </SelectItem>
                          <SelectItem value="stage_channel">
                            <span className="flex items-center gap-2">
                              <Mic2 className="text-ink-muted size-4" />
                              Stage Channel
                            </span>
                          </SelectItem>
                          <SelectItem value="external">
                            <span className="flex items-center gap-2">
                              <ExternalLink className="text-ink-muted size-4" />
                              External Link
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Channel selector / External link — conditional on type */}
                {watchedType !== 'external' ? (
                  <FormField
                    control={form.control}
                    name="channelId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-3 space-y-0">
                        <FormLabel className={FIELD_LABEL}>Select Voice Channel</FormLabel>
                        <Select
                          disabled={isPending || channelsQuery.isLoading}
                          onValueChange={field.onChange}
                          value={field.value ?? ''}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-glass-surface-1 text-ink w-full">
                              <SelectValue placeholder="Select voice room" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {voiceChannels.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No voice channels found
                              </SelectItem>
                            ) : (
                              voiceChannels.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="externalLink"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-3 space-y-0">
                        <FormLabel className={FIELD_LABEL}>Meeting Link URL</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="https://zoom.us/j/..., https://meet.google.com/..."
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startsAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-3 space-y-0">
                        <FormLabel className={FIELD_LABEL}>Starts At</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            disabled={isPending}
                            className="bg-glass-surface-1 text-ink"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endsAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-3 space-y-0">
                        <FormLabel className={FIELD_LABEL}>Ends At (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            value={field.value ?? ''}
                            disabled={isPending}
                            className="bg-glass-surface-1 text-ink"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : eventToEdit ? (
                      'Save changes'
                    ) : (
                      'Create event'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
