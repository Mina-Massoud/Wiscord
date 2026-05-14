import { useState } from 'react';
import { Copy, GripHorizontal, Palette, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { ThemeExportDialog } from './ThemeExportDialog';
import { ThemeTokenGroup } from './ThemeTokenGroup';
import { TOKEN_GROUPS, tokensByGroup } from './theme-tokens';
import { useThemeOverrides } from './useThemeOverrides';

interface ThemeGeneratorPanelProps {
  onClose: () => void;
}

export function ThemeGeneratorPanel({ onClose }: ThemeGeneratorPanelProps): React.JSX.Element {
  const { overrides, setOverride, resetToken, resetAll, isOverridden } = useThemeOverrides();
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const totalOverridden = Object.keys(overrides).filter(
    (id) => overrides[id] !== undefined && overrides[id] !== '',
  ).length;

  return (
    <>
      <aside
        className={cn(
          'fixed right-4 bottom-4 z-[60] flex max-h-[calc(100vh-2rem)] w-[340px] flex-col',
          'bg-glass-surface-2 border-glass-border-strong shadow-modal rounded-lg border',
          'backdrop-blur-glass-sm',
        )}
        role="dialog"
        aria-label="Theme generator"
        aria-modal="false"
      >
        <header
          className={cn(
            'flex shrink-0 items-center justify-between gap-2 px-3 py-2',
            'border-glass-border border-b',
          )}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="text-ink-subtle size-3.5" aria-hidden="true" />
            <Palette className="text-blurple size-4" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-control text-ink font-medium">Theme generator</span>
              <span className="text-badge text-ink-subtle font-mono">
                {totalOverridden} override{totalOverridden === 1 ? '' : 's'} · dev only
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close theme generator"
            className="size-7"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {TOKEN_GROUPS.map((group, index) => (
            <ThemeTokenGroup
              key={group.id}
              group={group}
              tokens={tokensByGroup(group.id)}
              overrides={overrides}
              isOverridden={isOverridden}
              onChange={setOverride}
              onReset={resetToken}
              defaultOpen={index === 0}
            />
          ))}
        </div>

        <footer
          className={cn(
            'flex shrink-0 items-center justify-between gap-2 px-3 py-2',
            'border-glass-border border-t',
          )}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={resetAll}
            disabled={totalOverridden === 0}
            className="text-caption gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset all
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            disabled={totalOverridden === 0}
            className="text-caption gap-1.5"
          >
            <Copy className="size-3.5" />
            Export
          </Button>
        </footer>
      </aside>
      <ThemeExportDialog
        isOpen={isExportOpen}
        onOpenChange={setIsExportOpen}
        overrides={overrides}
      />
    </>
  );
}
