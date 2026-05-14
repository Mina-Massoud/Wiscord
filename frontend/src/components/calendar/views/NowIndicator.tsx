import { useEffect, useState } from 'react';

interface NowIndicatorProps {
  hourHeightPx: number;
}

/**
 * Horizontal "you are here" line drawn across today's column in the week
 * and day views. Updates once per minute so it tracks live without
 * pegging a render loop. Positioned via inline `top` because the value is
 * a runtime computation, not a static token.
 *
 * The caller is responsible for only rendering this on today's column —
 * the indicator itself doesn't carry a day check.
 */
export function NowIndicator({ hourHeightPx }: NowIndicatorProps): React.JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Sync to the next minute boundary so multiple instances tick together.
    const ms = 60_000 - (Date.now() % 60_000);
    const initial = setTimeout(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 60_000);
      // Stash on the timeout closure so cleanup can clear it.
      (initial as unknown as { interval?: ReturnType<typeof setInterval> }).interval = id;
    }, ms);
    return () => {
      clearTimeout(initial);
      const id = (initial as unknown as { interval?: ReturnType<typeof setInterval> }).interval;
      if (id) clearInterval(id);
    };
  }, []);

  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * hourHeightPx;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top }}
    >
      <span className="bg-destructive rounded-pill size-2 -translate-x-1/2" />
      <span className="bg-destructive h-px flex-1" />
    </div>
  );
}
