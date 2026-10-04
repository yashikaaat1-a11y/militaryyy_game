/* ── Orders — assess, choose an order, execute ─────────────── */
import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { formatT, gridRef } from '../../utils/format';
import PanelHeader from './PanelHeader';

const ORDERS = [
  { type: 'OBSERVE', label: 'OBSERVE', desc: 'Hold eyes on, gather intel' },
  { type: 'MOVE', label: 'MOVE', desc: 'Reposition for vantage' },
  { type: 'INTERCEPT', label: 'INTERCEPT', desc: 'Engage reported contact' },
  { type: 'HOLD', label: 'HOLD', desc: 'Defend current positions' },
  { type: 'WITHDRAW', label: 'WITHDRAW', desc: 'Fall back to secondary' },
  { type: 'REQUEST_RECON', label: 'RECON', desc: 'Task aerial recon' },
];

const PHASE_HINT = {
  BRIEFING: 'Review the situation. Advance when ready.',
  NORMAL: 'All links nominal. Note unit positions and reports.',
  DEGRADATION: 'Links are degrading. Watch which units go quiet.',
  CONFLICTING: 'Reports disagree. Weigh source, age and confidence.',
  CONSEQUENCE: 'Order executed. Check the event log for the result.',
  REVEAL: 'Ground truth is on the map. Compare it with what you believed.',
};

/** Countdown for the decision window; freezes while the instructor holds. */
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
  const left = windowS - Math.max(0, now - state.decision_opened_at - paused);
  const frac = Math.max(0, Math.min(1, left / windowS));
  const cls = frac > 0.5 ? 'ok' : frac > 0.2 ? 'warn' : 'bad';

  return (
    <div className={`dclock ${cls}`}>
      <span className="dclock-label">DECISION WINDOW</span>
      <span className="dclock-time">{left >= 0 ? formatT(left) : `−${formatT(-left)}`}</span>
      <div className="dclock-bar"><i style={{ width: `${frac * 100}%` }} /></div>
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
  const [selected, setSelected] = useState(null);
  const [reasoning, setReasoning] = useState('');

  const isDecision = phase === 'DECISION';
  const canAdvance = !['IDLE', 'AAR', 'DECISION'].includes(phase);
  const maxDecisions = state?.config?.max_decisions || 1;
  const reconLeft = state?.recon_remaining ?? 0;
  const locked = isLoading || isPaused;
  const canExecute = isDecision && selected && assessment && !locked;

  const execute = useCallback(async () => {
    if (!canExecute) return;
    await makeDecision(selected, reasoning);
    setSelected(null);
    setReasoning('');
  }, [canExecute, makeDecision, selected, reasoning]);

  // Keyboard: 1–6 choose an order, Enter executes / advances
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || locked) return;
      if (isDecision && /^[1-6]$/.test(e.key)) setSelected(ORDERS[Number(e.key) - 1].type);
      if (e.key === 'Enter') {
        if (isDecision) execute();
        else if (canAdvance) advancePhase();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDecision, canAdvance, locked, execute, advancePhase]);

  const meta = state ? `${Math.min(decisions.length + (isDecision ? 1 : 0), maxDecisions)}/${maxDecisions}` : '';

  return (
    <section className={`panel orders ${isDecision ? 'live' : ''}`}>
      <PanelHeader index="03" title={isDecision ? 'ORDERS — DECISION REQUIRED' : 'ORDERS'} meta={meta} />

      {isDecision ? (
        <div className="orders-body">
          <DecisionClock state={state} />

          <div className={`step ${assessment ? 'done' : 'todo'}`}>
            <div className="step-head"><span className="step-n">A</span>ASSESS THE THREAT</div>
            <div className="step-text">
              {assessment
                ? <>Main threat estimated at <b>GRID {gridRef(assessment)}</b>. Click the map to move it.</>
                : 'Click the map where you believe the main enemy threat is.'}
            </div>
            <label className="conf-slider">
              <span>CONFIDENCE</span>
              <input
                type="range" min="0.05" max="1" step="0.05"
                value={assessConfidence}
                onChange={(e) => setAssessConfidence(parseFloat(e.target.value))}
                disabled={locked}
              />
              <b>{Math.round(assessConfidence * 100)}%</b>
            </label>
          </div>

          <div className="step">
            <div className="step-head"><span className="step-n">B</span>SELECT ORDER <span className="dim">· KEYS 1–6</span></div>
            <div className="order-grid">
              {ORDERS.map((o, i) => (
                <button
                  key={o.type}
                  className={`decision-btn order ${selected === o.type ? 'selected' : ''} ${o.type === 'INTERCEPT' ? 'kinetic' : ''}`}
                  onClick={() => setSelected(o.type)}
                  disabled={locked}
                >
                  <span className="order-key">{i + 1}</span>
                  <span className="order-label">{o.label}</span>
                  <span className="order-desc">{o.type === 'REQUEST_RECON' ? `${o.desc} · ${reconLeft} left` : o.desc}</span>
                </button>
              ))}
            </div>
            {selected && (
              <textarea
                className="reasoning-input"
                placeholder="Reasoning (optional, recorded for the AAR)"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={2}
              />
            )}
          </div>

          <button className="btn btn-primary btn-block confirm-btn" onClick={execute} disabled={!canExecute}>
            {!selected ? 'SELECT AN ORDER'
              : !assessment ? 'MARK THREAT ON MAP FIRST'
                : isLoading ? 'TRANSMITTING…'
                  : <>EXECUTE {ORDERS.find((o) => o.type === selected).label} <kbd>ENTER</kbd></>}
          </button>
        </div>
      ) : (
        <div className="orders-body">
          <div className="hint">
            {phase === 'IDLE' && 'No exercise running.'}
            {phase === 'AAR' && 'Exercise complete. Review the AAR.'}
            {PHASE_HINT[phase]}
          </div>
          {canAdvance && (
            <button className="btn btn-primary btn-block advance-btn" onClick={advancePhase} disabled={locked}>
              {isPaused ? 'HOLDING' : isLoading ? 'ADVANCING…'
                : <>{phase === 'REVEAL' ? 'OPEN AFTER ACTION REVIEW' : 'ADVANCE'} <kbd>ENTER</kbd></>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
