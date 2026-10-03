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
