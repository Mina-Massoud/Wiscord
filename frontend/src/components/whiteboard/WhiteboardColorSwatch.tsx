import type { Editor } from 'tldraw';
import { DefaultColorStyle, useValue } from 'tldraw';

import { cn } from '@/lib/cn';

interface WhiteboardColorSwatchProps {
  editor: Editor;
}

/**
 * Evernote-style swatch grid — eight colors hand-picked to read against
 * the glass dark canvas. tldraw's `DefaultColorStyle` accepts named
 * palette values (not hex); we display the visual hex but pass the
 * named id so tldraw's own stroke/fill rules pick it up.
 */
const SWATCHES = [
  { id: 'white', label: 'Chalk', hex: '#FFFFFF' },
  { id: 'blue', label: 'Blurple', hex: '#5865F2' },
  { id: 'light-blue', label: 'Sky', hex: '#3DDBD9' },
  { id: 'green', label: 'Mint', hex: '#57F287' },
  { id: 'yellow', label: 'Sun', hex: '#FEE75C' },
  { id: 'orange', label: 'Amber', hex: '#F0B232' },
  { id: 'red', label: 'Heat', hex: '#ED4245' },
  { id: 'violet', label: 'Ultraviolet', hex: '#9D6BFF' },
] as const;

export function WhiteboardColorSwatch({ editor }: WhiteboardColorSwatchProps): React.JSX.Element {
  // Reactive read of the "color for the next shape" style. Updates
  // whenever the user clicks a swatch or tldraw mutates the style for
  // any other reason (e.g. selecting a shape and reading its color into
  // the next-shape style). Drives the active ring on the matching tile.
  const currentColorId = useValue(
    'whiteboard color',
    () => editor.getStyleForNextShape(DefaultColorStyle),
    [editor],
  );

  return (
    <div className="flex w-44 flex-col gap-2">
      <div className="grid grid-cols-4 gap-1">
        {SWATCHES.map((swatch) => {
          const isActive = currentColorId === swatch.id;
          return (
            <button
              key={swatch.id}
              type="button"
              aria-label={swatch.label}
              aria-pressed={isActive}
              title={swatch.label}
              onClick={() => {
                editor.setStyleForNextShapes(DefaultColorStyle, swatch.id);
                editor.setStyleForSelectedShapes(DefaultColorStyle, swatch.id);
              }}
              className={cn(
                'flex size-8 items-center justify-center rounded-full',
                'duration-fast transition-colors ease-out',
                'focus-visible:ring-blurple focus-visible:ring-2 focus-visible:outline-none',
                isActive ? 'bg-glass-active' : 'hover:bg-glass-hover',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'duration-fast rounded-full transition-all ease-out',
                  isActive
                    ? 'ring-offset-glass-surface-2 size-6 ring-2 ring-white ring-offset-2'
                    : 'size-5 ring-1 ring-white/10',
                )}
                style={{ background: swatch.hex }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
