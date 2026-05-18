import { useMemo } from 'react';
import { Copy } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

import type { ThemeOverrides } from './theme-css-emitter';
import { formatExport } from './theme-export-format';
import { CodeBlock } from './ThemeExportDialogCodeBlock';

interface ThemeExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  overrides: ThemeOverrides;
}

async function copyToClipboard(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch (error) {
    logger.error('theme-overrides: clipboard write failed', error);
    toast.error("Couldn't copy. Select the text and copy manually.");
  }
}

export function ThemeExportDialog({
  isOpen,
  onOpenChange,
  overrides,
}: ThemeExportDialogProps): React.JSX.Element {
  const payload = useMemo(() => formatExport(overrides), [overrides]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-2 border-glass-border-strong max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export theme draft</DialogTitle>
          <DialogDescription>
            {payload.changedCount} token{payload.changedCount === 1 ? '' : 's'} changed. Copy each
            block into the file it names, or copy the combined handoff to paste back to Claude.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <CodeBlock
            label="tailwind.config.ts"
            body={payload.tailwindBlock}
            onCopy={() => {
              void copyToClipboard(payload.tailwindBlock, 'Tailwind block copied');
            }}
          />
          <CodeBlock
            label="globals.css"
            body={payload.cssVarsBlock}
            onCopy={() => {
              void copyToClipboard(payload.cssVarsBlock, 'CSS vars block copied');
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void copyToClipboard(payload.combinedHandoff, 'Combined handoff copied');
            }}
            className="self-end"
          >
            <Copy className="mr-1.5 size-3.5" />
            Copy combined handoff
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
