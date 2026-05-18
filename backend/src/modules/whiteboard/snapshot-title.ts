/**
 * Auto-generated snapshot titles. Format: `Snapshot · <relative-date> ·
 * <short-channel-id>`. Cheap, deterministic, distinguishable in a
 * scrollable list. The user can rename later if we expose a rename
 * route — for v1 we just stamp the time.
 */
export function generateSnapshotTitle(_channelId: string, now: Date = new Date()): string {
  const time = now.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Snapshot · ${time}`;
}
