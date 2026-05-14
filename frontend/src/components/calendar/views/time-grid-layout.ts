import type { CalendarEvent } from '@/types/calendar';

/**
 * Lays overlapping events out in horizontal columns for the time grids.
 *
 * Greedy column-packing: events are sorted by start time, then each event
 * is placed in the leftmost column whose previous occupant has already
 * finished. The total column count for an overlap cluster determines the
 * width fraction every event in the cluster renders at.
 *
 * Returned `lane` is the column index; `lanes` is the cluster's column
 * count. `top` / `height` are pixel offsets within the time-grid (caller
 * passes the per-hour height).
 */

export interface PositionedEvent {
  event: CalendarEvent;
  /** 0-indexed column position inside its overlap cluster. */
  lane: number;
  /** Total column count for the cluster this event belongs to. */
  lanes: number;
  /** Pixel offset from the top of the day column. */
  top: number;
  /** Pixel height of the rendered tile (min 24 for legibility). */
  height: number;
}

export function layoutDayEvents(
  events: CalendarEvent[],
  day: Date,
  hourHeightPx: number,
): PositionedEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const intersecting = events
    .map((e) => ({
      event: e,
      start: clamp(new Date(e.startAt), dayStart, dayEnd),
      end: clamp(new Date(e.endAt), dayStart, dayEnd),
    }))
    .filter((x) => x.start < x.end && !x.event.allDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const clusters = clusterByOverlap(intersecting);
  const out: PositionedEvent[] = [];

  for (const cluster of clusters) {
    const lanes: { end: Date }[][] = [];
    const assignments: { item: (typeof cluster)[number]; lane: number }[] = [];

    for (const item of cluster) {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i]!;
        const last = lane[lane.length - 1];
        if (!last || last.end <= item.start) {
          lane.push({ end: item.end });
          assignments.push({ item, lane: i });
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([{ end: item.end }]);
        assignments.push({ item, lane: lanes.length - 1 });
      }
    }

    for (const { item, lane } of assignments) {
      const minutesFromStart = (item.start.getTime() - dayStart.getTime()) / 60000;
      const durationMinutes = (item.end.getTime() - item.start.getTime()) / 60000;
      out.push({
        event: item.event,
        lane,
        lanes: lanes.length,
        top: (minutesFromStart / 60) * hourHeightPx,
        height: Math.max(24, (durationMinutes / 60) * hourHeightPx),
      });
    }
  }

  return out;
}

function clusterByOverlap<T extends { start: Date; end: Date }>(items: T[]): T[][] {
  const out: T[][] = [];
  let cluster: T[] = [];
  let clusterEnd = new Date(0);
  for (const item of items) {
    if (item.start < clusterEnd) {
      cluster.push(item);
      if (item.end > clusterEnd) clusterEnd = item.end;
    } else {
      if (cluster.length) out.push(cluster);
      cluster = [item];
      clusterEnd = item.end;
    }
  }
  if (cluster.length) out.push(cluster);
  return out;
}

function clamp(d: Date, min: Date, max: Date): Date {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}
