/* ── NATO APP-6 style map symbols (simplified) ─────────────── */
import React from 'react';

// Standard APP-6 fill colours
const FILL = { friendly: '#80e0ff', hostile: '#ff8080', unknown: '#ffff80' };
const STROKE = '#0b0d0e';

function Frame({ affiliation }) {
  if (affiliation === 'hostile') {
    return <path d="M18 2 L34 16 L18 30 L2 16 Z" fill={FILL.hostile} stroke={STROKE} strokeWidth="1.6" />;
  }
  if (affiliation === 'unknown') {
    // Quatrefoil
    return (
      <path
        d="M18 4 a6 6 0 0 1 8 6 a6 6 0 0 1 0 12 a6 6 0 0 1 -8 6 a6 6 0 0 1 -8 -6 a6 6 0 0 1 0 -12 a6 6 0 0 1 8 -6 Z"
        fill={FILL.unknown} stroke={STROKE} strokeWidth="1.6"
      />
    );
  }
  return <rect x="2" y="7" width="32" height="20" fill={FILL.friendly} stroke={STROKE} strokeWidth="1.6" />;
}

/** Function icon inside the frame, by unit type. */
function Icon({ type, affiliation }) {
  const s = { stroke: STROKE, strokeWidth: 1.4, fill: 'none' };
  const friendly = affiliation === 'friendly';
  const [x0, y0, x1, y1] = friendly ? [2, 7, 34, 27] : [11, 10, 25, 22];
  switch (type) {
    case 'INFANTRY':
      return <g {...s}><line x1={x0} y1={y0} x2={x1} y2={y1} /><line x1={x0} y1={y1} x2={x1} y2={y0} /></g>;
    case 'ARMOR':
      return <ellipse cx="18" cy={(y0 + y1) / 2} rx={friendly ? 10 : 6} ry={friendly ? 5 : 3.5} {...s} />;
    case 'RECON':
      return <line x1={x0} y1={y1} x2={x1} y2={y0} {...s} />;
    case 'COMMAND':
      return <text x="18" y="21" textAnchor="middle" fontSize="9" fontWeight="700" fill={STROKE} fontFamily="IBM Plex Mono, monospace">HQ</text>;
    default:
      return <text x="18" y="20.5" textAnchor="middle" fontSize="10" fontWeight="700" fill={STROKE} fontFamily="IBM Plex Mono, monospace">?</text>;
  }
}

export function NatoSymbol({ affiliation = 'friendly', type, size = 30 }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 36 32" className="nato-symbol">
      <Frame affiliation={affiliation} />
      <Icon type={type} affiliation={affiliation} />
    </svg>
  );
}
