/**
 * Right rail of the friends view. Shows ongoing activities; empty by default.
 * Static — no realtime wiring in v1.
 */
export function ActiveNowPanel(): React.JSX.Element {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center px-4">
        <h2 className="text-ink text-subhead font-semibold">Active Now</h2>
      </div>

      <div className="px-3">
        <div className="bg-surface-callout rounded-lg px-4 py-3 text-center">
          <h3 className="text-ink text-control font-semibold">It&apos;s quiet for now…</h3>
          <p className="text-ink-muted text-caption mt-1.5">
            When a friend starts a study session or jumps into voice, you&apos;ll see them here.
          </p>
        </div>
      </div>
    </>
  );
}
