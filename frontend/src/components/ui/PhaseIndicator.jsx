/* ── Phase Indicator — shows current scenario phase ────────── */
import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import './PhaseIndicator.css';

const PHASE_INFO = {
  IDLE: { label: 'STANDBY', color: '#555', icon: '⏸' },
  BRIEFING: { label: 'MISSION BRIEFING', color: '#2196f3', icon: '📋' },
  NORMAL: { label: 'NORMAL OPERATIONS', color: '#4caf50', icon: '🟢' },
  DEGRADATION: { label: 'COMMS DEGRADATION', color: '#ff9800', icon: '⚠️' },
  CONFLICTING: { label: 'CONFLICTING REPORTS', color: '#f44336', icon: '❗' },
  DECISION: { label: 'DECISION REQUIRED', color: '#e91e63', icon: '🎯' },
  CONSEQUENCE: { label: 'CONSEQUENCES', color: '#9c27b0', icon: '💥' },
  REVEAL: { label: 'GROUND TRUTH', color: '#00bcd4', icon: '🔍' },
  AAR: { label: 'AFTER ACTION REVIEW', color: '#ff5722', icon: '📊' },
};

const PHASE_ORDER = ['BRIEFING', 'NORMAL', 'DEGRADATION', 'CONFLICTING', 'DECISION', 'CONSEQUENCE', 'REVEAL', 'AAR'];

export default function PhaseIndicator() {
  const phase = useGameStore((s) => s.phase);
  const info = PHASE_INFO[phase] || PHASE_INFO.IDLE;
  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="phase-indicator">
      <div className="phase-bar">
        {PHASE_ORDER.map((p, i) => {
          const pInfo = PHASE_INFO[p];
          const isActive = i === currentIdx;
          const isCompleted = i < currentIdx;
          return (
            <div
              key={p}
              className={`phase-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              style={{ '--phase-color': pInfo.color }}
            >
              <div className="phase-dot" />
              <span className="phase-label">{pInfo.icon}</span>
            </div>
          );
        })}
        <div
          className="phase-progress-line"
          style={{ width: `${Math.max(0, (currentIdx / (PHASE_ORDER.length - 1)) * 100)}%` }}
        />
      </div>
      <div className="phase-current" style={{ color: info.color }}>
        {info.icon} {info.label}
      </div>
    </div>
  );
}
