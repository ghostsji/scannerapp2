// The rules for picking a BOM on the phone, the same as Tracklab's own scan
// page (src/scan/BomPick.tsx in the Tracklab repo). The pick itself lives on
// the server: GET/POST /api/bom-picks (see SCANNER_APP_API.md).

const same = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();

/** The line a scanned item is picked for: one still to pick first. Null when the item isn't on the BOM. */
export function matchLine(lines, partNumbers) {
  const mine = lines.filter((l) => partNumbers.some((p) => same(p, l.code)));
  return mine.find((l) => l.state !== 'done') || mine[0] || null;
}

/** The place a scan is from: the one a Tracklab reel label names (and its lot), else the only place with stock left. */
export function placeFor(line, labelPlace, labelLot) {
  const open = line.places.filter((p) => p.available > 0);
  if (labelPlace) {
    const at = open.filter((p) => same(p.locationCode, labelPlace));
    const hit = at.find((p) => !labelLot || same(p.lot, labelLot)) || at[0];
    if (hit) return hit;
  }
  if (labelLot) { const lot = open.find((p) => same(p.lot, labelLot)); if (lot) return lot; }
  return open.length === 1 ? open[0] : null;
}

/** What to tell the picker about a line beyond its quantity. */
export function lineNotes(line, all) {
  const notes = [];
  if (line.itemsForBomLine > 1) {
    const others = all.filter((l) => same(l.bomCode, line.bomCode)).map((l) => l.code);
    notes.push(`BOM line ${line.bomCode} needs ${line.itemsForBomLine} items: ${others.join(', ')}`);
  }
  const left = line.need - line.picked;
  const biggest = Math.max(0, ...line.places.map((p) => p.available));
  const total = line.places.reduce((s, p) => s + p.available, 0);
  if (left > 0 && total < left) notes.push(`Short: only ${total} left to pick`);
  else if (left > 0 && line.reel && biggest > 0 && biggest < left) notes.push('Needs more than one reel');
  return notes;
}

export const sameCode = same;
