import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, NotebookPen } from 'lucide-react';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { useCreateEvent } from '@/queries/calendar';
import type { CalendarCategory } from '@/types/calendar';

import { CalendarTimeField } from './CalendarTimeField';
import { CATEGORY_FILL_BG } from './category-color';

const schema = z.object({
  title: z.string().trim().min(1, 'Give it a title').max(200),
  categoryId: z.string().min(1, 'Pick a category'),
  startTime: z.string().min(1, 'Pick a start time'),
  note: z.string().max(4000).default(''),
});

type QuickAddFormValues = z.infer<typeof schema>;

interface EventQuickAddPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bounding rect of the clicked day cell; popover anchors here. */
  anchorRect: DOMRect | null;
  /** The day the user clicked. Time defaults to next round hour. */
  prefillDay: Date | null;
  channelId: string | null;
  categories: CalendarCategory[];
  /** Escape hatch: open the full Dialog with the values typed so far. */
  onPromoteToFull: (partial: { title: string; startAt: string; note: string }) => void;
}

/**
 * Compact event-add popover anchored to the clicked calendar cell.
 * The full `EventComposer` Dialog is overkill for the common case
 * ("title + when + maybe a note") — most events don't need
 * recurrence, all-day, end-time, or a description field. This pop-up
 * covers the 90% case in three controls, with an `Add details →`
 * link to promote to the full Dialog when the user wants the rest.
 *
 * Anchors via a Radix virtual ref built from the rect captured in the
 * cell click handler, so we don't need to thread a DOM ref through
 * the view tree.
 */
export function EventQuickAddPopover({
  open,
  onOpenChange,
  anchorRect,
  prefillDay,
  channelId,
  categories,
  onPromoteToFull,
}: EventQuickAddPopoverProps): React.JSX.Element {
  const create = useCreateEvent();
  const [showNote, setShowNote] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [noteSlotRef] = useAutoAnimate<HTMLDivElement>();

  const defaults = useMemo<QuickAddFormValues>(
    () => buildDefaults(prefillDay, categories),
    [prefillDay, categories],
  );

  const form = useForm<QuickAddFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  // Reset whenever the popover re-opens — fresh values per click.
  useEffect(() => {
    if (open) {
      form.reset(defaults);
      setShowNote(false);
      // Autofocus the title input on next paint so the user can
      // start typing immediately.
      const t = window.setTimeout(() => titleRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, defaults, form]);

  // Radix virtual ref — Popper uses the bounding rect to position.
  const virtualRef = useMemo(() => {
    if (!anchorRect) return null;
    return {
      current: {
        getBoundingClientRect: () => anchorRect,
      },
    };
  }, [anchorRect]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!prefillDay) return;
    const startAt = combineStartAt(prefillDay, values.startTime);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000).toISOString();
    try {
      await create.mutateAsync({
        channelId,
        categoryId: values.categoryId,
        title: values.title,
        description: values.note,
        startAt: startAt.toISOString(),
        endAt,
        allDay: false,
        recurrence: { freq: 'none', count: 1 },
      });
      toast.success('Event added to your calendar');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the event. Try again.");
    }
  });

  const promote = (): void => {
    const values = form.getValues();
    if (!prefillDay) return;
    const startAt = combineStartAt(prefillDay, values.startTime).toISOString();
    onPromoteToFull({ title: values.title, startAt, note: values.note });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {virtualRef ? (
        <PopoverAnchor virtualRef={virtualRef as unknown as React.RefObject<HTMLElement>} />
      ) : null}
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={8}
        // Opaque (not glass-*) on purpose: this popover floats over the
        // calendar grid, and a translucent surface would let the grid
        // text bleed through behind the form fields. Z stays at
        // shadcn's default (z-50 baked into PopoverContent); DOM mount
        // order puts it above the expanded island shell (also z-50)
        // and above any inner Select content (also z-50, mounts after).
        className="bg-surface-2 border-glass-border w-80 p-3 shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <header className="mb-2 flex items-center justify-between">
          <p className="text-ink text-tab leading-none font-semibold">
            {prefillDay ? formatHeader(prefillDay) : 'New event'}
          </p>
          <button
            type="button"
            onClick={promote}
            className="text-ink-muted hover:text-ink text-badge inline-flex items-center gap-1 font-medium transition-colors"
          >
            Add details
            <ArrowRight className="size-3" aria-hidden />
          </button>
        </header>

        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        titleRef.current = el;
                      }}
                      placeholder="What's happening?"
                      autoComplete="off"
                      className="text-body h-9"
                    />
                  </FormControl>
                  <FormMessage className="text-badge" />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className={cn('size-2 rounded-full', CATEGORY_FILL_BG[c.color])}
                              />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-badge" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <CalendarTimeField
                        value={field.value}
                        onChange={field.onChange}
                        ariaLabel="Start time"
                      />
                    </FormControl>
                    <FormMessage className="text-badge" />
                  </FormItem>
                )}
              />
            </div>

            <div ref={noteSlotRef}>
              {showNote ? (
                <FormField
                  key="note-field"
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="Add a quick note (optional)"
                          className="text-body resize-none"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : (
                <button
                  key="note-toggle"
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="text-ink-muted hover:text-ink text-badge inline-flex items-center gap-1.5 self-start font-medium transition-colors"
                >
                  <NotebookPen className="size-3" aria-hidden />
                  Add note
                </button>
              )}
            </div>

            <div className="mt-1 flex items-center justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                Save
              </Button>
            </div>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  );
}

function buildDefaults(
  prefillDay: Date | null,
  categories: CalendarCategory[],
): QuickAddFormValues {
  const seed = prefillDay ?? new Date();
  const hasExplicitTime =
    seed.getHours() !== 0 || seed.getMinutes() !== 0 || seed.getSeconds() !== 0;

  // For bare-day clicks, anchor at the next round hour from "now"
  // (or 9 AM if the day is in the future / not today). Snappier than
  // the previous 9 AM default that always required a manual change.
  const start = new Date(seed);
  if (!hasExplicitTime) {
    const isToday = isSameDay(seed, new Date());
    if (isToday) {
      const now = new Date();
      start.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
  }

  return {
    title: '',
    categoryId: categories[0]?.id ?? '',
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    note: '',
  };
}

function combineStartAt(day: Date, time: string): Date {
  const [hStr, mStr] = time.split(':');
  const out = new Date(day);
  out.setHours(Number.parseInt(hStr, 10), Number.parseInt(mStr, 10), 0, 0);
  return out;
}

function formatHeader(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
