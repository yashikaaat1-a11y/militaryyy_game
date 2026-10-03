/* ── Decision Controls — trainee action buttons ──────────── */
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { formatT } from '../../utils/format';
import './DecisionControls.css';

const DECISIONS = [
  { type: 'OBSERVE', label: 'OBSERVE', icon: '👁️', desc: 'Continue observation — gather more intel', color: '#4caf50' },
  { type: 'MOVE', label: 'MOVE', icon: '🏃', desc: 'Reposition units to better vantage', color: '#2196f3' },
  { type: 'INTERCEPT', label: 'INTERCEPT', icon: '⚔️', desc: 'Engage and intercept contact', color: '#f44336' },
  { type: 'HOLD', label: 'HOLD', icon: '🛡️', desc: 'Hold current positions defensively', color: '#ff9800' },
  { type: 'WITHDRAW', label: 'WITHDRAW', icon: '↩️', desc: 'Tactical withdrawal to secondary pos', color: '#9c27b0' },
  { type: 'REQUEST_RECON', label: 'REQUEST RECON', icon: '🛩️', desc: 'Request aerial reconnaissance', color: '#00bcd4' },
];

/** Counts down the decision window; freezes while the instructor has paused. */
function DecisionClock({ state }) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(t);
  }, []);

  if (!state?.decision_opened_at) return null;
  const windowS = state.decision_window_s || 100;
  const pausedNow = state.is_paused && state.paused_at ? now - state.paused_at : 0;
  const paused = state.paused_total - state.decision_opened_paused_total + pausedNow;
  const elapsed = Math.max(0, now - state.decision_opened_at - paused);
  const left = windowS - elapsed;
  const frac = Math.max(0, Math.min(1, left / windowS));
  const color = frac > 0.5 ? '#4caf50' : frac > 0.2 ? '#ff9800' : '#f44336';

  return (
    <div className="decision-clock">
      <div className="clock-row">
        <span>DECISION WINDOW</span>
        <span style={{ color }}>{left >= 0 ? formatT(left) : `-${formatT(-left)} OVER`}</span>
      </div>
      <div className="clock-bar">
        <div className="clock-fill" style={{ width: `${frac * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export default function DecisionControls() {
  const phase = useGameStore((s) => s.phase);
  const state = useGameStore((s) => s.scenarioState);
  const decisions = useGameStore((s) => s.decisions);
  const isPaused = useGameStore((s) => s.isPaused);
  const makeDecision = useGameStore((s) => s.makeDecision);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const isLoading = useGameStore((s) => s.isLoading);
  const assessment = useGameStore((s) => s.assessment);
  const assessConfidence = useGameStore((s) => s.assessConfidence);
  const setAssessConfidence = useGameStore((s) => s.setAssessConfidence);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [reasoning, setReasoning] = useState('');

  const isDecisionPhase = phase === 'DECISION';
  const canAdvance = !['IDLE', 'AAR', 'DECISION'].includes(phase);
  const maxDecisions = state?.config?.max_decisions || 3;
  const reconLeft = state?.recon_remaining ?? 0;
  const locked = isLoading || isPaused;

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
        {state && (
          <span className="report-count">{Math.min(decisions.length + (isDecisionPhase ? 1 : 0), maxDecisions)} / {maxDecisions}</span>
        )}
      </div>

      {isDecisionPhase ? (
        <div className="decision-content">
          <div className="decision-urgency">
            ⚡ DECISION {decisions.length + 1} OF {maxDecisions} — Choose your action
          </div>
          <DecisionClock state={state} />

          <div className={`assess-box ${assessment ? 'done' : ''}`}>
            <div className="assess-step">STEP 1 · COMMANDER'S ASSESSMENT</div>
            {assessment ? (
              <div className="assess-pos">
                📍 Main threat estimated at ({assessment.x.toFixed(1)}, {assessment.z.toFixed(1)}) — click the map to move
              </div>
            ) : (
              <div className="assess-hint">Click the map where you believe the main enemy threat is.</div>
            )}
            <div className="assess-conf">
              <span>How sure are you?</span>
              <input
                type="range" min="0.05" max="1" step="0.05"
                value={assessConfidence}
                onChange={(e) => setAssessConfidence(parseFloat(e.target.value))}
                disabled={locked}
              />
              <span className="assess-conf-val">{Math.round(assessConfidence * 100)}%</span>
            </div>
          </div>

          <div className="assess-step">STEP 2 · ORDER</div>
          <div className="decision-grid">
            {DECISIONS.map((d) => (
              <button
                key={d.type}
                className={`decision-btn ${selectedDecision === d.type ? 'selected' : ''}`}
                style={{ '--btn-color': d.color }}
                onClick={() => setSelectedDecision(d.type)}
                disabled={locked}
              >
                <span className="decision-icon">{d.icon}</span>
                <span className="decision-label">{d.label}</span>
                <span className="decision-desc">
                  {d.type === 'REQUEST_RECON' ? `${d.desc} (${reconLeft} left)` : d.desc}
                </span>
              </button>
            ))}
          </div>
          {selectedDecision && (
            <div className="decision-confirm">
              <textarea
                className="reasoning-input"
                placeholder="Optional: Explain your reasoning (recorded for the AAR)..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={2}
              />
              <button
                className="confirm-btn"
                onClick={handleDecide}
                disabled={locked || !assessment}
              >
                {!assessment
                  ? '📍 MARK YOUR THREAT ESTIMATE FIRST'
                  : isLoading ? 'EXECUTING...' : `EXECUTE: ${selectedDecision.replace('_', ' ')}`}
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
                  {phase === 'CONSEQUENCE' && 'Decision consequences unfolding — check the timeline'}
                  {phase === 'REVEAL' && 'Ground truth revealed — compare with your assessment'}
                </div>
                {canAdvance && (
                  <button
                    className="advance-btn"
                    onClick={advancePhase}
                    disabled={locked}
                  >
                    {isPaused ? '⏸ PAUSED' : isLoading ? 'ADVANCING...' : phase === 'REVEAL' ? '📊 OPEN AFTER ACTION REVIEW' : '▶ ADVANCE PHASE'}
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
