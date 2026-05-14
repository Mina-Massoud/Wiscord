import { useEffect, useState } from 'react';
import {
  Download,
  Eraser,
  MousePointer2,
  Palette,
  Pen,
  Redo2,
  Shapes,
  StickyNote,
  Type,
  Undo2,
} from 'lucide-react';
import type { Editor } from 'tldraw';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';

import { WhiteboardColorSwatch } from './WhiteboardColorSwatch';
import { useExportPng } from './useExportPng';

interface WhiteboardToolbarProps {
  editor: Editor;
  channelId: string;
}

/** tldraw tool ids — the strings `editor.setCurrentTool` accepts. */
type ToolId = 'select' | 'draw' | 'eraser' | 'geo' | 'text' | 'note';

const TOOLS: ReadonlyArray<{
  id: ToolId;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'draw', label: 'Pen', icon: Pen },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'geo', label: 'Shapes', icon: Shapes },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'note', label: 'Sticky note', icon: StickyNote },
];

/**
 * Bottom-center floating glass dock. Replaces tldraw's stock chrome so
 * the surface reads as Wiscord — pill-shaped, translucent, the wallpaper
 * glowing through. Tool buttons stay disabled-looking until the editor
 * is wired in (we never render this without one) and reflect the live
 * current-tool by subscribing to tldraw's editor signal.
 */
export function WhiteboardToolbar({
  editor,
  channelId,
}: WhiteboardToolbarProps): React.JSX.Element {
  const [activeTool, setActiveTool] = useState<string>(editor.getCurrentToolId());
  const { exportPng, isExporting } = useExportPng(editor, channelId);

  // tldraw's current tool can change from the keyboard, the inspector,
  // or programmatically — listen to the editor's store changes so the
  // pressed-state stays accurate without us polling.
  useEffect(() => {
    const handler = (): void => setActiveTool(editor.getCurrentToolId());
    handler();
    const off = editor.store.listen(handler, { source: 'all', scope: 'session' });
    return () => off();
  }, [editor]);

  const setTool = (id: ToolId): void => {
    editor.setCurrentTool(id);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div
        role="toolbar"
        aria-label="Whiteboard tools"
        className={cn(
          'pointer-events-auto absolute bottom-6 left-1/2 z-10 -translate-x-1/2',
          'bg-glass-surface-2 border-glass-border shadow-glass',
          'rounded-pill flex items-center gap-1 border px-2 py-1.5',
          'backdrop-blur-glass-sm',
        )}
      >
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  className={cn('size-9 rounded-full', isActive && 'bg-glass-active text-ink')}
                  onClick={() => setTool(tool.id)}
                >
                  <Icon className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}

        <span className="bg-glass-border mx-1 h-5 w-px" aria-hidden />

        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Color"
                  className="size-9 rounded-full"
                >
                  <Palette className="size-4" aria-hidden />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Color</TooltipContent>
          </Tooltip>
          <PopoverContent
            sideOffset={12}
            className="bg-glass-surface-2 border-glass-border w-auto p-2"
          >
            <WhiteboardColorSwatch editor={editor} />
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Undo"
              className="size-9 rounded-full"
              onClick={() => editor.undo()}
            >
              <Undo2 className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Redo"
              className="size-9 rounded-full"
              onClick={() => editor.redo()}
            >
              <Redo2 className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>

        <span className="bg-glass-border mx-1 h-5 w-px" aria-hidden />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isExporting}
              className="h-9 gap-1.5 rounded-full px-3"
              onClick={() => {
                void (async () => {
                  try {
                    await exportPng();
                    toast.success('Board saved as PNG');
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message
                        ? err.message
                        : "Couldn't export. Try again?";
                    toast.error(message);
                  }
                })();
              }}
            >
              <Download className="size-4" aria-hidden />
              <span className="text-control">Export PNG</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save the board as a PNG file</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
