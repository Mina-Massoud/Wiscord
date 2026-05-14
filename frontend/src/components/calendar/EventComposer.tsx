import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/queries/calendar';
import type { CalendarCategory, CalendarEvent, CalendarRecurrenceFreq } from '@/types/calendar';

import { CATEGORY_FILL_BG } from './category-color';
import { CalendarDateField } from './CalendarDateField';
import { CalendarTimeField } from './CalendarTimeField';

const schema = z
  .object({
    title: z.string().trim().min(1, 'Give it a title').max(200),
    categoryId: z.string().min(1, 'Pick a category'),
    description: z.string().max(4000).default(''),
    startDate: z.string().min(1, 'Start date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endDate: z.string().min(1, 'End date is required'),
    endTime: z.string().min(1, 'End time is required'),
    allDay: z.boolean().default(false),
    recurrenceFreq: z.enum(['none', 'weekly_n']).default('none'),
    recurrenceCount: z.coerce.number().int().min(1).max(52).default(1),
  })
  .refine((v) => combine(v.startDate, v.startTime) < combine(v.endDate, v.endTime), {
    message: 'End must be after start',
    path: ['endTime'],
  });

type FormValues = z.infer<typeof schema>;

interface EventComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  categories: CalendarCategory[];
  /** When set, edits this event; otherwise creates new. */
  editing?: CalendarEvent | null;
  /** Pre-fill start-of-day for "click an empty day" flow. */
  prefillDay?: Date | null;
}

/**
 * Modal form for creating or editing a single calendar event. RHF + Zod
 * underneath, shadcn primitives on top. Optimistic write is held back to
 * the simple invalidation path — see the Failure Modes rule: rollback
 * costs more code than the perceived UX win on a creation flow that
 * already closes the dialog on success.
 */
export function EventComposer({
  open,
  onOpenChange,
  channelId,
  categories,
  editing = null,
  prefillDay = null,
}: EventComposerProps): React.JSX.Element {
  const create = useCreateEvent();
  const update = useUpdateEvent(editing?.id ?? '');
  const remove = useDeleteEvent();
  const isEditing = Boolean(editing);

  const defaultValues = useMemo<FormValues>(
    () => initialValues(editing, prefillDay, categories),
    [editing, prefillDay, categories],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const allDay = form.watch('allDay');
  const recurrenceFreq = form.watch('recurrenceFreq') as CalendarRecurrenceFreq;
  const submitting = create.isPending || update.isPending || remove.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const startAt = combine(values.startDate, values.startTime).toISOString();
    const endAt = combine(values.endDate, values.endTime).toISOString();

    try {
      if (editing) {
        await update.mutateAsync({
          patch: {
            title: values.title,
            categoryId: values.categoryId,
            description: values.description,
            startAt,
            endAt,
            allDay: values.allDay,
            recurrence: {
              freq: values.recurrenceFreq,
              count: values.recurrenceCount,
            },
          },
          channelId,
        });
        toast.success('Event updated');
      } else {
        await create.mutateAsync({
          channelId,
          categoryId: values.categoryId,
          title: values.title,
          description: values.description,
          startAt,
          endAt,
          allDay: values.allDay,
          recurrence: {
            freq: values.recurrenceFreq,
            count: values.recurrenceCount,
          },
        });
        toast.success('Event added to your calendar');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the event. Try again.");
    }
  });

  const onDelete = async (): Promise<void> => {
    if (!editing) return;
    try {
      await remove.mutateAsync({ eventId: editing.id, channelId });
      toast.success('Event removed');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the event.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-glass-surface-2 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription className="text-caption text-ink-muted">
            What are you blocking time for?
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Linear algebra study block" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className={`rounded-pill inline-block size-2 ${CATEGORY_FILL_BG[c.color]}`}
                            />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="border-glass-border bg-glass-surface-1 flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                  <FormLabel className="text-control text-ink">All-day event</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starts</FormLabel>
                      <FormControl>
                        <CalendarDateField
                          value={field.value}
                          onChange={field.onChange}
                          ariaLabel="Start date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!allDay && (
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Start time</FormLabel>
                        <FormControl>
                          <CalendarTimeField
                            value={field.value}
                            onChange={field.onChange}
                            ariaLabel="Start time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ends</FormLabel>
                      <FormControl>
                        <CalendarDateField
                          value={field.value}
                          onChange={field.onChange}
                          ariaLabel="End date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!allDay && (
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">End time</FormLabel>
                        <FormControl>
                          <CalendarTimeField
                            value={field.value}
                            onChange={field.onChange}
                            ariaLabel="End time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="recurrenceFreq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Doesn't repeat</SelectItem>
                        <SelectItem value="weekly_n">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {recurrenceFreq === 'weekly_n' && (
                <FormField
                  control={form.control}
                  name="recurrenceCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How many weeks?</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={52} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What are you covering?" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:justify-between">
              {isEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={submitting}
                  className="text-destructive hover:text-destructive gap-2"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {isEditing ? 'Save changes' : 'Add event'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function combine(date: string, time: string): Date {
  // `date` is `YYYY-MM-DD`, `time` is `HH:MM` (or empty when all-day). The
  // parsed Date is interpreted in the viewer's local time zone.
  const t = time || '00:00';
  return new Date(`${date}T${t}:00`);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValues(
  editing: CalendarEvent | null,
  prefillDay: Date | null,
  categories: CalendarCategory[],
): FormValues {
  if (editing) {
    const start = new Date(editing.startAt);
    const end = new Date(editing.endAt);
    return {
      title: editing.title,
      categoryId: editing.categoryId,
      description: editing.description,
      startDate: toLocalDateInput(start),
      startTime: toLocalTimeInput(start),
      endDate: toLocalDateInput(end),
      endTime: toLocalTimeInput(end),
      allDay: editing.allDay,
      recurrenceFreq: editing.recurrence.freq,
      recurrenceCount: editing.recurrence.count,
    };
  }

  const seed = prefillDay ?? new Date();
  const start = new Date(seed);
  // When the caller passed a precise time (e.g. clicking a slot in the
  // hour grid) we honor it; bare day-only seeds (month grid clicks land
  // at midnight) bump to 9 AM so the picker starts on a friendly hour.
  const hasExplicitTime =
    seed.getHours() !== 0 || seed.getMinutes() !== 0 || seed.getSeconds() !== 0;
  if (!hasExplicitTime) start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  return {
    title: '',
    categoryId: categories[0]?.id ?? '',
    description: '',
    startDate: toLocalDateInput(start),
    startTime: toLocalTimeInput(start),
    endDate: toLocalDateInput(end),
    endTime: toLocalTimeInput(end),
    allDay: false,
    recurrenceFreq: 'none',
    recurrenceCount: 1,
  };
}
