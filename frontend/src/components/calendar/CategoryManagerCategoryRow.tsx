import { type CalendarCategory, type CalendarCategoryColor } from '@/types/calendar';
import { useState } from 'react';
import { useDeleteCategory, useUpdateCategory } from '@/queries/calendar';
import { toast } from '@/lib/toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { CATEGORY_FILL_BG } from './category-color';
import { Pencil, Trash2 } from 'lucide-react';
import { ColorPicker } from './CategoryManagerColorPicker';

export function CategoryRow({ category }: { category: CalendarCategory }): React.JSX.Element {
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
