/* ── After Action Review — the differentiating feature ────── */
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { formatT, missionTime, pct } from '../../utils/format';
import { downloadJSON, printReport } from './exportReport';
import { WhatIfTab, CognitiveTab } from './AARInsights';
import './AARPanel.css';

const CATEGORIES = [
  { key: 'decision_quality', label: 'Decision Quality', short: 'Quality', weight: 30, color: '#2196f3' },
  { key: 'response_time', label: 'Response Time', short: 'Speed', weight: 20, color: '#4caf50' },
  { key: 'uncertainty_handling', label: 'Uncertainty Handling', short: 'Uncert.', weight: 20, color: '#ff9800' },
  { key: 'communication_handling', label: 'Comm Handling', short: 'Comms', weight: 15, color: '#9c27b0' },
  { key: 'resource_management', label: 'Resource Mgmt', short: 'Resource', weight: 15, color: '#00bcd4' },
];

const scoreColor = (v) => (v >= 75 ? '#4caf50' : v >= 55 ? '#ff9800' : '#f44336');

function ScoreGauge({ label, value, weight, color }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="score-gauge">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(48,54,61,0.5)" strokeWidth="5" />
        <circle
          cx="45" cy="45" r="38"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="45" y="42" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
          {value.toFixed(0)}
        </text>
        <text x="45" y="56" textAnchor="middle" fill="#8b949e" fontSize="8" fontFamily="JetBrains Mono, monospace">
          / 100
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
      <div className="gauge-weight">{weight}% weight</div>
    </div>
  );
}

function ScoresTab({ score }) {
  return (
    <div className="score-section">
      <div className="score-gauges">
        {CATEGORIES.map((c) => (
          <ScoreGauge key={c.key} label={c.label} value={score[c.key]} weight={c.weight} color={c.color} />
        ))}
      </div>

      {score.decision_reviews?.length > 0 && (
        <table className="review-table">
          <thead>
            <tr>
              <th>#</th><th>Decision</th><th>Time</th>
              {CATEGORIES.map((c) => <th key={c.key} title={c.label}>{c.short}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {score.decision_reviews.map((r) => (
              <tr key={r.index}>
                <td>{r.index}</td>
                <td className="review-decision">{r.decision_type.replace('_', ' ')}</td>
                <td>T+{formatT(r.t)}</td>
                {CATEGORIES.map((c) => (
                  <td key={c.key} style={{ color: scoreColor(r.scores[c.key]) }}>{r.scores[c.key]}</td>
                ))}
                <td className="review-total" style={{ color: scoreColor(r.total) }}>{r.total.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="score-footnote">
        Each decision is judged on the information available at that moment — not on the hidden ground truth.
      </div>
    </div>
  );
}

function ReplayTab({ frames, index, setIndex }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return undefined;
    if (index >= frames.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => setIndex(index + 1), 1400);
    return () => clearTimeout(t);
  }, [playing, index, frames.length, setIndex]);

  if (!frames.length) return <div className="feed-empty">No replay recorded.</div>;
  const frame = frames[index] || frames[0];

  return (
    <div className="replay-section">
      <div className="replay-controls">
        <button className="replay-btn" onClick={() => setIndex(0)} title="Start">⏮</button>
        <button className="replay-btn" onClick={() => setIndex(Math.max(0, index - 1))} title="Previous">◀</button>
        <button
          className="replay-btn primary"
          onClick={() => {
            if (index >= frames.length - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
        <button className="replay-btn" onClick={() => setIndex(Math.min(frames.length - 1, index + 1))} title="Next">▶</button>
        <button className="replay-btn" onClick={() => setIndex(frames.length - 1)} title="End">⏭</button>
      </div>
      <input
        className="replay-slider"
        type="range"
        min="0"
        max={frames.length - 1}
        value={index}
        onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
      />
      <div className="replay-now">
        Frame {index + 1}/{frames.length} · T+{formatT(frame.t)} · <strong>{frame.label}</strong>
      </div>
      <div className="replay-note">
        The 3D view shows the recorded state. Amber = what your units reported; red = where the enemy actually was.
      </div>
      <div className="replay-frames">
        {frames.map((f, i) => (
          <button
            key={i}
            className={`replay-frame ${i === index ? 'active' : ''} phase-${f.phase.toLowerCase()}`}
            onClick={() => { setPlaying(false); setIndex(i); }}
          >
            <span className="frame-time">T+{formatT(f.t)}</span>
            <span className="frame-label">{f.label}</span>
            <span className="frame-stats">{f.contacts.length} reports</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DecisionPointView({ point }) {
  const k = point.knowledge;
  const t = point.truth;
  return (
    <>
      <div className="dp-header">
        <span className="decision-badge">{point.index}. {point.decision_type.replace('_', ' ')}</span>
        <span className="dp-meta">Round {point.round} · T+{formatT(point.t)} · decided in {k.wait_s.toFixed(0)}s</span>
        {point.total != null && (
          <span className="dp-score" style={{ color: scoreColor(point.total) }}>{point.total.toFixed(0)}</span>
        )}
      </div>

      <div className="comparison-view">
        <div className="comparison-column">
          <div className="comparison-title trainee">👤 WHAT YOU KNEW</div>
          <div className="comparison-content">
            <div className="comparison-stat"><span>Avg confidence</span><span>{pct(k.avg_confidence)}</span></div>
            <div className="comparison-stat">
              <span>Reports conflicting</span>
              <span className={k.conflict ? 'warn-value' : ''}>{k.conflict ? `YES (${k.spread} grid)` : 'NO'}</span>
            </div>
            <div className="comparison-subtitle">Communication Status</div>
            {Object.entries(k.comm_status).filter(([u]) => u !== 'OVERLORD').map(([unit, status]) => (
              <div key={unit} className="comparison-stat">
                <span>{unit}</span>
                <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
              </div>
            ))}
            <div className="comparison-subtitle">Reports in hand ({k.reports.length})</div>
            {k.reports.map((r) => (
              <div key={r.id} className="comparison-report">
                <div className="report-source">{r.source} · {r.category} · {pct(r.confidence)}{r.delay_s > 0 ? ` · ${r.delay_s.toFixed(0)}s late` : ''}</div>
                <div className="report-text">{r.content}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="comparison-divider">
          <div className="divider-label">VS</div>
        </div>

        <div className="comparison-column">
          <div className="comparison-title truth">🎯 GROUND TRUTH AT THAT MOMENT</div>
          <div className="comparison-content">
            {t.hostiles.map((h, i) => (
              <div key={i} className="comparison-report hostile">
                <div className="report-source">⚠ {h.name}{h.engaged ? ' (engaged)' : ''}</div>
                <div className="report-text">{h.strength} · {h.type}</div>
                <div className="report-pos">📍 grid {h.grid}</div>
              </div>
            ))}
            {k.best_report && (
              <div className="comparison-stat">
                <span>Your best report ({k.best_report.source}) error</span>
                <span className="truth-value">{t.best_report_error} grid</span>
              </div>
            )}
            <div className="comparison-stat">
              <span>Reports lost in transit</span>
              <span className="truth-value">{t.dropped_reports}</span>
            </div>
          </div>
        </div>
      </div>

      {(point.verdict || point.truth_note) && (
        <div className="dp-verdict">
          {point.verdict && <div><strong>Verdict:</strong> {point.verdict}.</div>}
          {point.truth_note && <div className="dp-truth-note">{point.truth_note}</div>}
        </div>
      )}
    </>
  );
}

function ComparisonTab({ comparison, frames, setReplayIndex }) {
  const points = comparison?.decision_points || [];
  const [sel, setSel] = useState(0);

  // Sync the 3D replay to the moment the selected decision was made
  useEffect(() => {
    const p = points[sel];
    if (!p) return;
    const fi = frames.findIndex((f) => f.phase === 'DECISION' && f.round === p.round);
    if (fi >= 0) setReplayIndex(fi);
  }, [sel, points, frames, setReplayIndex]);

  if (!comparison) return null;
  const select = setSel;

  if (!points.length) {
    return <div className="feed-empty">No decisions were made — nothing to compare.</div>;
  }

  return (
    <div>
      <div className="dp-tabs">
        {points.map((p, i) => (
          <button key={i} className={`dp-tab ${sel === i ? 'active' : ''}`} onClick={() => select(i)}>
            Decision {p.index}
          </button>
        ))}
      </div>
      <DecisionPointView point={points[sel]} />
    </div>
  );
}

function TimelineTab({ events, startedAt, frames, setReplayIndex }) {
  const jump = (ev) => {
    // Jump the replay to the last frame recorded at or before this event
    let idx = 0;
    frames.forEach((f, i) => { if (f.t <= ev.timestamp - startedAt + 0.05) idx = i; });
    setReplayIndex(idx);
  };
  return (
    <div className="aar-timeline">
      {events.map((event, i) => (
        <div
          key={event.id || i}
          className={`aar-timeline-item type-${event.event_type.toLowerCase()}`}
          onClick={() => jump(event)}
          title="Show this moment in the 3D replay"
        >
          <div className="aar-tl-dot" />
          <div className="aar-tl-content">
            <span className="aar-tl-type">
              {event.event_type} <span className="aar-tl-time">{missionTime(event.timestamp, startedAt)}</span>
            </span>
            <span className="aar-tl-desc">{event.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedbackTab({ score, decisions, maxDecisions }) {
  return (
    <div className="feedback-section">
      <div className="feedback-title">📝 Performance Analysis</div>
      {score.explanations.map((exp, i) => (
        <div key={i} className="feedback-item">
          <div className="feedback-bullet" />
          <div className="feedback-text">{exp}</div>
        </div>
      ))}

      {score.decision_reviews?.length > 0 && (
        <div className="decision-summary">
          <div className="feedback-title">⚡ Decisions Made ({decisions.length} / {maxDecisions})</div>
          {score.decision_reviews.map((r) => (
            <div key={r.index} className="review-card" style={{ borderLeftColor: scoreColor(r.total) }}>
              <div className="review-card-head">
                <span className="decision-badge">{r.index}. {r.decision_type.replace('_', ' ')}</span>
                <span style={{ color: scoreColor(r.total) }}>{r.total.toFixed(0)} / 100</span>
              </div>
              <div className="feedback-text">{r.explanation}</div>
              {r.notes.map((n, i) => <div key={i} className="review-note">• {n}</div>)}
              {r.reasoning && <div className="decision-reasoning">Your reasoning: "{r.reasoning}"</div>}
              {r.truth_note && <div className="dp-truth-note">🔍 {r.truth_note}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="aar-quote">
        "We do not train decisions in perfect information. We train decisions when the information itself becomes the problem."
      </div>
    </div>
  );
}

export default function AARPanel() {
  const score = useGameStore((s) => s.score);
  const comparison = useGameStore((s) => s.comparison);
  const events = useGameStore((s) => s.events);
  const decisions = useGameStore((s) => s.decisions);
  const scenarioState = useGameStore((s) => s.scenarioState);
  const frames = useGameStore((s) => s.replayFrames);
  const replayIndex = useGameStore((s) => s.replayIndex);
  const setReplayIndex = useGameStore((s) => s.setReplayIndex);
  const exportReport = useGameStore((s) => s.exportReport);
  const resetScenario = useGameStore((s) => s.resetScenario);
  const [tab, setTab] = useState('score');

  if (!score) return null;

  const maxDecisions = scenarioState?.config?.max_decisions || 3;
  const startedAt = scenarioState?.started_at;
  const totalColor = scoreColor(score.total);

  const handleExport = async (kind) => {
    const report = await exportReport();
    if (!report) return;
    if (kind === 'json') downloadJSON(report);
    else printReport(report);
  };

  const TABS = [
    ['score', '📊 Scores'],
    ['cognitive', '🧠 Cognitive'],
    ['whatif', '🔀 What-If'],
    ['replay', '⏪ Replay'],
    ['comparison', '🔍 Knew vs Truth'],
    ['timeline', '📋 Timeline'],
    ['feedback', '💡 Feedback'],
  ];

  return (
    <div className="aar-panel">
      <div className="aar-header">
        <div className="aar-title">
          <span className="aar-icon">📊</span>
          AFTER ACTION REVIEW
        </div>
        <div className="aar-total" style={{ color: totalColor }}>
          <span className="total-score">{score.total.toFixed(0)}</span>
          <span className="total-label">/ 100</span>
        </div>
      </div>

      <div className="aar-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`aar-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="aar-content">
        {tab === 'score' && <ScoresTab score={score} />}
        {tab === 'cognitive' && <CognitiveTab cognitive={score.cognitive} />}
        {tab === 'whatif' && <WhatIfTab comparison={comparison} cognitive={score.cognitive} />}
        {tab === 'replay' && <ReplayTab frames={frames} index={replayIndex ?? 0} setIndex={setReplayIndex} />}
        {tab === 'comparison' && (
          <ComparisonTab comparison={comparison} frames={frames} setReplayIndex={setReplayIndex} />
        )}
        {tab === 'timeline' && (
          <TimelineTab events={events} startedAt={startedAt} frames={frames} setReplayIndex={setReplayIndex} />
        )}
        {tab === 'feedback' && <FeedbackTab score={score} decisions={decisions} maxDecisions={maxDecisions} />}
      </div>

      <div className="aar-footer">
        <button className="export-btn" onClick={() => handleExport('json')}>⬇ EXPORT JSON</button>
        <button className="export-btn" onClick={() => handleExport('pdf')}>🖨 EXPORT PDF</button>
        <button className="restart-btn" onClick={resetScenario}>
          🔄 NEW SCENARIO
        </button>
      </div>
    </div>
  );
}
