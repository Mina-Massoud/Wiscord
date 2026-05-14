import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/queries/calendar';
import {
  CALENDAR_CATEGORY_COLORS,
  type CalendarCategory,
  type CalendarCategoryColor,
} from '@/types/calendar';

import { CATEGORY_FILL_BG } from './category-color';

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CalendarCategory[];
  scope: 'user' | 'channel';
  channelId: string | null;
}

/**
 * Sheet panel for managing the category palette. Built-ins can be renamed
 * and recolored but not deleted; user-defined categories are deletable as
 * long as no events still reference them (the backend rejects otherwise).
 */
export function CategoryManager({
  open,
  onOpenChange,
  categories,
  scope,
  channelId,
}: CategoryManagerProps): React.JSX.Element {
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState<CalendarCategoryColor>('blurple');
  const create = useCreateCategory();
  const isCreating = create.isPending;

  const handleCreate = async (): Promise<void> => {
    const name = draftName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({
        scope,
        channelId: scope === 'channel' && channelId ? channelId : undefined,
        name,
        color: draftColor,
      });
      setDraftName('');
      setDraftColor('blurple');
      toast.success('Category added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add category");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-glass-surface-2 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Categories</SheetTitle>
          <SheetDescription>
            Recolor or rename the built-ins, or add your own. Color stripes show on every event
            tile.
          </SheetDescription>
        </SheetHeader>

        <ol className="mt-4 space-y-2">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ol>

        <SheetFooter className="mt-6 flex-col gap-3 sm:flex-col">
          <div className="text-control text-ink font-medium">New category</div>
          <div className="flex items-center gap-2">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Lab work, internship, …"
              maxLength={60}
            />
            <ColorPicker value={draftColor} onChange={setDraftColor} />
            <Button
              size="icon"
              onClick={handleCreate}
              disabled={isCreating || draftName.trim().length === 0}
              aria-label="Add category"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CategoryRow({ category }: { category: CalendarCategory }): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState<CalendarCategoryColor>(category.color);
  const update = useUpdateCategory(category.id);
  const remove = useDeleteCategory();
  const isBuiltin = category.builtinSlug !== null;
  const submitting = update.isPending || remove.isPending;

  const save = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await update.mutateAsync({ name: trimmed, color });
      toast.success('Category updated');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update category");
    }
  };

  const del = async (): Promise<void> => {
    try {
      await remove.mutateAsync(category.id);
      toast.success('Category removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete category");
    }
  };

  if (editing) {
    return (
      <li className="border-glass-border bg-glass-surface-1 flex items-center gap-2 rounded-md border px-2 py-2">
        <ColorPicker value={color} onChange={setColor} />
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button size="sm" onClick={save} disabled={submitting}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setName(category.name);
            setColor(category.color);
          }}
          disabled={submitting}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="border-glass-border bg-glass-surface-1 flex items-center gap-3 rounded-md border px-3 py-2">
      <span
        aria-hidden
        className={cn('rounded-pill inline-block size-3', CATEGORY_FILL_BG[category.color])}
      />
      <span className="text-control text-ink flex-1 truncate">{category.name}</span>
      <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>
      {!isBuiltin && (
        <Button
          size="icon"
          variant="ghost"
          onClick={del}
          disabled={submitting}
          aria-label="Delete"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: CalendarCategoryColor;
  onChange: (next: CalendarCategoryColor) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Category color">
      {CALENDAR_CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          role="radio"
          aria-checked={value === c}
          className={cn(
            'rounded-pill duration-fast ease-wiscord size-5 border transition-transform',
            CATEGORY_FILL_BG[c],
            value === c ? 'border-ink scale-110' : 'border-transparent hover:scale-105',
          )}
        />
      ))}
    </div>
  );
}
