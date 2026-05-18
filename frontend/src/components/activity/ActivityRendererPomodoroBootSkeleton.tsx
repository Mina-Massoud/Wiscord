/**
 * Pomodoro boot skeleton. Holds the same layout footprint as the real
 * embed so the swap is invisible — opacity-only fade-in handles the
 * transition. Phase chip, timer placeholder, controls row, and the
 * gradient bloom all in pulse-y muted form.
 */
export function PomodoroBootSkeleton(): React.JSX.Element {
  return (
    <div className="relative flex h-full w-full flex-col gap-4 overflow-hidden p-5">
      {/* Soft idle bloom — matches the real embed's gradient shape. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 45%, rgba(88, 101, 242, 0.10) 0%, rgba(88, 101, 242, 0.04) 30%, rgba(88, 101, 242, 0) 60%)',
        }}
      />
      <div className="relative z-10 flex h-full w-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="bg-blurple/70 size-2 animate-pulse rounded-full" />
          <span className="bg-glass-surface-2 h-3 w-24 animate-pulse rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="bg-glass-surface-2 h-14 w-44 animate-pulse rounded-md" />
            <span className="bg-glass-surface-2 h-3 w-32 animate-pulse rounded" />
          </div>
          <span className="bg-glass-surface-2 h-11 w-32 animate-pulse rounded-full" />
        </div>
        <span className="bg-glass-surface-2 mt-auto h-12 w-full animate-pulse rounded-md" />
      </div>
    </div>
  );
}
