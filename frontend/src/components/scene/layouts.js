/* ── World layouts — one source of truth for each terrain's look ── */

// Map extent: the engine plays inside ±15; the sand table is a 32×32 block.
export const MAP_SIZE = 32;
export const MAP_HALF = MAP_SIZE / 2;
export const GRID_STEP = 3; // matches the engine's grid() helper
export const TABLE_BASE = -2.4;

// Colours run low → high ground; `rock` is used on steep slopes.
export const LAYOUTS = {
  URBAN: {
    palette: { low: '#3f5233', mid: '#55663d', high: '#6d7448', peak: '#8a8458', rock: '#5c5a52', soil: '#3b2f24' },
    sky: { bg: '#0b0e10', fog: '#0f1418', key: '#ffd2a1', keyPos: [14, 16, 8], fill: '#6f8fb3', hemiSky: '#9fb4c9', hemiGround: '#2b2a22', exposure: 1.0 },
    roads: [
      { points: [[0, -15], [0, -5], [1, 0], [1, 8], [0, 15]], width: 1.0, lanes: true },
      { points: [[-15, 0], [-5, 0], [0, 0], [5, 0], [15, 0]], width: 1.0, lanes: true },
      { points: [[-5, -5], [-3, -3], [-1, 0]], width: 0.6 },
      { points: [[1, 8], [5, 9], [9, 12]], width: 0.6 },
    ],
    buildings: [
      // Town centre
      [-3, 3, 1.1, 1.8, 1.1], [-1.5, 4, 1.0, 2.4, 1.2], [-2.5, 5.4, 1.2, 1.5, 1.0], [0, 3.4, 1.0, 2.8, 1.0],
      [2.4, 4.4, 1.1, 1.8, 1.1], [-4.4, 4.6, 1.0, 1.3, 1.2], [3.2, 2.2, 1.2, 1.6, 0.9],
      // West block
      [-9, -3, 1.4, 1.4, 1.2], [-7.5, -4.6, 1.0, 1.9, 1.0], [-10.2, -5, 1.2, 1.2, 1.4], [-8.6, 3.4, 1.3, 1.5, 1.0],
      // East block
      [6, 3, 1.2, 1.2, 1.2], [7.4, 4.6, 1.0, 1.8, 1.1], [8.8, 2.8, 1.3, 1.4, 1.0], [6.4, -3.2, 1.6, 1.2, 1.2],
      [8.6, -4.4, 1.1, 2.0, 1.1],
      // North outskirts
      [-5, 7, 1.2, 1.5, 1.0], [-8, 11, 1.1, 1.2, 1.3], [-4.2, 12, 1.4, 1.6, 1.0], [11, 9.5, 1.2, 1.3, 1.2],
      // HQ compound
      [-2.2, -6.6, 1.2, 1.5, 1.0], [2.4, -9.6, 1.4, 1.1, 1.0],
    ],
    trees: 55, rocks: 8, treeKind: 'broadleaf',
    hq: [0, -8],
    clear: [[-6, 2], [5, 0], [2, 6], [7, 8], [-3, 9]],
  },
  MOUNTAIN: {
    palette: { low: '#3a4a35', mid: '#4f5a41', high: '#77786a', peak: '#e8ecef', rock: '#6b6a66', soil: '#3a332c' },
    sky: { bg: '#0c1014', fog: '#141b22', key: '#e4eeff', keyPos: [-12, 18, 10], fill: '#89a6c9', hemiSky: '#c9daf0', hemiGround: '#2f3328', exposure: 1.05 },
    roads: [
      { points: [[-5, -15], [-2, -8], [0, 0], [4, 6], [8, 10], [11, 14]], width: 0.55 },
    ],
    buildings: [
      [3, 8, 1.1, 1.3, 1.1], [-5, 5, 1.3, 1.6, 1.0], [-1.6, -7.4, 1.0, 1.0, 1.0], [6.5, -3, 1.0, 1.1, 1.0],
    ],
    trees: 110, rocks: 45, treeKind: 'pine',
    hq: [0, -10],
    clear: [[-4, 5], [6, 3], [0, 8], [5, 12], [-6, 9]],
  },
  RIVER: {
    palette: { low: '#2f4a33', mid: '#3e5a3a', high: '#55693f', peak: '#6f7550', rock: '#55574f', soil: '#33291f' },
    sky: { bg: '#0a0e10', fog: '#0f1719', key: '#d9e8f2', keyPos: [10, 15, -6], fill: '#5f8aa3', hemiSky: '#a9c4d4', hemiGround: '#24301f', exposure: 0.95 },
    roads: [
      { points: [[-14, 5], [-4, 5], [-2, 5]], width: 0.7, lanes: true },
      { points: [[4, 5], [10, 5], [14, 6]], width: 0.7, lanes: true },
    ],
    bridge: { x: 1, z: 5, length: 7, width: 1.1 },
    buildings: [
      [-4.5, 7.6, 1.1, 1.4, 1.0], [6.6, -5.6, 1.2, 1.2, 1.1], [-10, -6, 1.3, 1.3, 1.2], [-9, 9, 1.2, 1.5, 1.0],
      [8.5, -9, 1.1, 1.1, 1.1], [9.5, 9.5, 1.2, 1.2, 1.0],
    ],
    trees: 85, rocks: 12, treeKind: 'broadleaf',
    water: { x: 1, width: 6, level: -0.95 },
    hq: [-8, 0],
    clear: [[2, -4], [4, 6], [8, 2], [10, 10]],
  },
  DESERT: {
    palette: { low: '#b39463', mid: '#c4a571', high: '#d4b886', peak: '#e2c99a', rock: '#9b7b52', soil: '#7a5c3b' },
    sky: { bg: '#100d0a', fog: '#1d1712', key: '#ffd08a', keyPos: [16, 12, 6], fill: '#8fa3b8', hemiSky: '#f0d9b0', hemiGround: '#6b5235', exposure: 1.0 },
    roads: [
      { points: [[-15, -2], [15, -2]], width: 0.9 },
      { points: [[0, -15], [0, 15]], width: 0.7 },
    ],
    buildings: [
      [-3, 3, 1.2, 1.1, 1.2], [4, 5, 1.1, 1.0, 1.4], [-5, -4.5, 1.3, 1.3, 1.0], [6.5, -6, 1.6, 0.9, 1.2],
      [-8, 8, 1.0, 0.9, 1.0],
    ],
    trees: 6, rocks: 40, treeKind: 'palm',
    hq: [0, -12],
    clear: [[-5, 0], [5, 0], [0, 10], [0, 15]],
  },
};

export const layoutFor = (type) => LAYOUTS[type] || LAYOUTS.URBAN;

/** Deterministic PRNG so props land in the same place every run. */
export function seededRandom(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from point to a polyline (for keeping props off roads). */
export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}
