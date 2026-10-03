/* ── Decision Controls — trainee action buttons ──────────── */
import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import './DecisionControls.css';

const DECISIONS = [
  { type: 'OBSERVE', label: 'OBSERVE', icon: '👁️', desc: 'Continue observation — gather more intel', color: '#4caf50' },
  { type: 'MOVE', label: 'MOVE', icon: '🏃', desc: 'Reposition units to better vantage', color: '#2196f3' },
  { type: 'INTERCEPT', label: 'INTERCEPT', icon: '⚔️', desc: 'Engage and intercept contact', color: '#f44336' },
  { type: 'HOLD', label: 'HOLD', icon: '🛡️', desc: 'Hold current positions defensively', color: '#ff9800' },
  { type: 'WITHDRAW', label: 'WITHDRAW', icon: '↩️', desc: 'Tactical withdrawal to secondary pos', color: '#9c27b0' },
  { type: 'REQUEST_RECON', label: 'REQUEST RECON', icon: '🛩️', desc: 'Request aerial reconnaissance', color: '#00bcd4' },
];

export default function DecisionControls() {
  const phase = useGameStore((s) => s.phase);
  const makeDecision = useGameStore((s) => s.makeDecision);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const isLoading = useGameStore((s) => s.isLoading);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [reasoning, setReasoning] = useState('');

  const isDecisionPhase = phase === 'DECISION';
  const canAdvance = !['IDLE', 'AAR'].includes(phase);

  const handleDecide = async () => {
    if (!selectedDecision) return;
    await makeDecision(selectedDecision, reasoning);
    setSelectedDecision(null);
    setReasoning('');
  };

  return (
    <div className="decision-controls">
      <div className="panel-header">
        <span className="panel-icon">🎯</span>
        <span>COMMAND DECISIONS</span>
      </div>

      {isDecisionPhase ? (
        <div className="decision-content">
          <div className="decision-urgency">
            ⚡ DECISION REQUIRED — Choose your action
          </div>
          <div className="decision-grid">
            {DECISIONS.map((d) => (
              <button
                key={d.type}
                className={`decision-btn ${selectedDecision === d.type ? 'selected' : ''}`}
                style={{ '--btn-color': d.color }}
                onClick={() => setSelectedDecision(d.type)}
                disabled={isLoading}
              >
                <span className="decision-icon">{d.icon}</span>
                <span className="decision-label">{d.label}</span>
                <span className="decision-desc">{d.desc}</span>
              </button>
            ))}
          </div>
          {selectedDecision && (
            <div className="decision-confirm">
              <textarea
                className="reasoning-input"
                placeholder="Optional: Explain your reasoning..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={2}
              />
              <button
                className="confirm-btn"
                onClick={handleDecide}
                disabled={isLoading}
              >
                {isLoading ? 'EXECUTING...' : `EXECUTE: ${selectedDecision}`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="decision-content">
          <div className="advance-section">
            {phase === 'IDLE' ? (
              <div className="phase-message">Create a scenario to begin</div>
            ) : phase === 'AAR' ? (
              <div className="phase-message">Scenario complete — Review AAR</div>
            ) : (
              <>
                <div className="phase-message">
                  {phase === 'BRIEFING' && 'Review the mission brief and proceed when ready'}
                  {phase === 'NORMAL' && 'Monitoring normal operations — advance when ready'}
                  {phase === 'DEGRADATION' && 'Communications degrading — observe the effects'}
                  {phase === 'CONFLICTING' && 'Conflicting reports incoming — assess carefully'}
                  {phase === 'CONSEQUENCE' && 'Decision consequences unfolding...'}
                  {phase === 'REVEAL' && 'Ground truth revealed — compare with your assessment'}
                </div>
                {canAdvance && (
                  <button
                    className="advance-btn"
                    onClick={advancePhase}
                    disabled={isLoading}
                  >
                    {isLoading ? 'ADVANCING...' : '▶ ADVANCE PHASE'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
