import { useState } from 'react';
import { Plus } from 'lucide-react';

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
import { toast } from '@/lib/toast';
import { useCreateCategory } from '@/queries/calendar';
import { type CalendarCategory, type CalendarCategoryColor } from '@/types/calendar';
import { CategoryRow } from './CategoryManagerCategoryRow';
import { ColorPicker } from './CategoryManagerColorPicker';

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
