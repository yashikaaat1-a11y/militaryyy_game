/* ── Phase Indicator — segmented exercise phase track ───────── */
import React from 'react';
import { useGameStore } from '../../stores/gameStore';

const PHASES = [
  ['BRIEFING', 'BRF', 'Briefing'],
  ['NORMAL', 'NRM', 'Normal operations'],
  ['DEGRADATION', 'DEG', 'Comms degradation'],
  ['CONFLICTING', 'CNF', 'Conflicting reports'],
  ['DECISION', 'DEC', 'Decision required'],
  ['CONSEQUENCE', 'CSQ', 'Consequences'],
  ['REVEAL', 'RVL', 'Ground truth'],
  ['AAR', 'AAR', 'After action review'],
];

export default function PhaseIndicator() {
  const phase = useGameStore((s) => s.phase);
  const current = PHASES.findIndex(([p]) => p === phase);
  const label = PHASES[current]?.[2] || 'Standby';

  return (
    <div className="phase-track">
      <div className="phase-cells">
        {PHASES.map(([p, abbr], i) => (
          <div key={p} className={`phase-cell ${i === current ? 'active' : ''} ${i < current ? 'done' : ''} ${p === 'DECISION' ? 'decision' : ''}`}>
            {abbr}
          </div>
        ))}
      </div>
      <div className={`phase-label ${phase === 'DECISION' ? 'urgent' : ''}`}>{label.toUpperCase()}</div>
    </div>
  );
}
