import { Copy, FileCode2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface CodeBlockProps {
  label: string;
  body: string;
  onCopy: () => void;
}

export function CodeBlock({ label, body, onCopy }: CodeBlockProps): React.JSX.Element {
  return (
    <div className="border-glass-border bg-surface-composer rounded-md border">
      <div className="border-glass-border flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-control text-ink-muted flex items-center gap-1.5 font-mono">
          <FileCode2 className="size-3.5" />
          {label}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCopy}
          className="text-caption gap-1.5"
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
      </div>
      <pre
        className={cn(
          'text-caption text-ink max-h-[240px] overflow-auto px-3 py-2 font-mono leading-relaxed',
        )}
      >
        {body}
      </pre>
    </div>
  );
}
