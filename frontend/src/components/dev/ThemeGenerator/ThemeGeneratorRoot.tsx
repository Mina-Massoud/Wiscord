import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

import { cn } from '@/lib/cn';

import { ThemeGeneratorPanel } from './ThemeGeneratorPanel';

const SHORTCUT_HINT = 'Cmd/Ctrl + Shift + T';

function isToggleShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 't') return false;
  if (!event.shiftKey) return false;
  return event.metaKey || event.ctrlKey;
}

// Only renders in dev builds. Mounted once at the App root.
// Toggle with Cmd/Ctrl+Shift+T or by clicking the floating launcher button.
export function ThemeGeneratorRoot(): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isToggleShortcut(event)) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (true) return null;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open theme generator"
          title={`Theme generator — ${SHORTCUT_HINT}`}
          className={cn(
            'fixed right-4 bottom-4 z-[60] flex size-10 items-center justify-center rounded-full',
            'bg-glass-surface-2 border-glass-border-strong text-ink-muted hover:text-blurple',
            'backdrop-blur-glass-sm shadow-modal border transition-colors',
          )}
        >
          <Palette className="size-4" />
        </button>
      )}
      {isOpen && <ThemeGeneratorPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
