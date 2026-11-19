// My scans, loaded a page at a time as the list is scrolled.

export const SCANS_PAGE = 20;
const at = (m) => new Date(m.capturedAt || m.createdAt).getTime() || 0;

/**
 * My scans after a page arrives: the new rows replace the ones with the same
 * id (their status may have changed), nothing is listed twice, newest first
 * (as the server sorts them).
 */
export function mergeScans(prev, page) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of page) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => at(b) - at(a) || b.id - a.id);
}

/** Whether a scroll position is near enough the end of the list to load the next page. */
export const nearEnd = ({ layoutMeasurement, contentOffset, contentSize }, margin = 400) =>
  layoutMeasurement.height + contentOffset.y >= contentSize.height - margin;
