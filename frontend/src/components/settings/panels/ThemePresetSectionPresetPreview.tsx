import { type ThemePreset } from '@/lib/theme-presets';

/**
 * Inline mini-preview of the preset: chrome bar with a "server" dot, a
 * canvas pane with two channel rows and a primary CTA. Uses the preset's
 * own surfaces / accent / radii via inline styles so each card looks
 * different even before the user picks one.
 */
export function PresetPreview({ preset }: { preset: ThemePreset }): React.JSX.Element {
  const { surfaces, accent, radius } = preset;
  return (
    <div
      className="flex h-20 overflow-hidden"
      style={{ borderRadius: `${radius.sm}px`, backgroundColor: surfaces.canvas }}
    >
      <div
        className="flex w-7 flex-col items-center gap-1.5 py-2"
        style={{ backgroundColor: surfaces.chrome }}
      >
        <span
          className="size-4"
          style={{ backgroundColor: accent, borderRadius: `${radius.md}px` }}
        />
        <span
          className="size-4"
          style={{ backgroundColor: surfaces.surface2, borderRadius: `${radius.md}px` }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div
          className="h-2 w-3/5"
          style={{ backgroundColor: surfaces.surface2, borderRadius: `${radius.sm}px` }}
        />
        <div
          className="h-2 w-4/5"
          style={{ backgroundColor: surfaces.callout, borderRadius: `${radius.sm}px` }}
        />
        <div className="mt-auto flex items-center gap-1.5">
          <span
            className="h-3 w-10"
            style={{ backgroundColor: accent, borderRadius: `${radius.sm}px` }}
          />
          <span
            className="h-3 w-5"
            style={{ backgroundColor: surfaces.surface2, borderRadius: `${radius.sm}px` }}
          />
        </div>
      </div>
    </div>
  );
}
