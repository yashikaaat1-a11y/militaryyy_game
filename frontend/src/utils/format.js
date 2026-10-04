/* ── Formatting helpers ──────────────────────────────────── */

/** Seconds → "m:ss" mission clock. */
export function formatT(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Absolute epoch seconds → "T+m:ss" relative to scenario start. */
export function missionTime(epoch, startedAt) {
  if (!epoch || !startedAt) return '';
  return `T+${formatT(epoch - startedAt)}`;
}

export const pct = (v) => `${Math.round((v || 0) * 100)}%`;

/** Map grid reference, identical to the engine's grid(): 3×3 cells, A–J / 0–9. */
export function gridRef(p) {
  const clamp = (v) => Math.max(0, Math.min(9, v));
  const col = String.fromCharCode(65 + clamp(Math.floor((p.x + 15) / 3)));
  const row = clamp(Math.floor((p.z + 15) / 3));
  return `${col}-${row}`;
}
