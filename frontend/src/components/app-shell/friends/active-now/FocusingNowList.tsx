import { SectionHeader } from './FocusingNowListSectionHeader';

/**
 * "Focusing now" — rooms currently mid-Pomodoro.
 *
 * There is no server-scoped focus-session data yet: the Pomodoro/voice system
 * lives in a separate labs surface keyed by its own ids, disconnected from
 * server channels. Rather than fabricate rows, this renders an honest,
 * forward-looking empty state. When voice sessions are bridged to server
 * channels, this becomes a real query (a `useFocusingRooms()` hook feeding the
 * list) — the surface stays, the data source changes.
 */
export function FocusingNowList(): React.JSX.Element {
  return (
    <section aria-labelledby="focusing-now-heading">
      <SectionHeader id="focusing-now-heading">Focusing now</SectionHeader>
      <p className="text-ink-subtle text-caption px-4 pb-1">
        Quiet right now. Friends in focus sessions will show up here.
      </p>
    </section>
  );
}
