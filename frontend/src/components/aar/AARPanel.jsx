/* ── After Action Review — the differentiating feature ────── */
import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import './AARPanel.css';

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

function ComparisonView({ comparison }) {
  if (!comparison) return null;

  return (
    <div className="comparison-view">
      <div className="comparison-column">
        <div className="comparison-title trainee">👤 TRAINEE KNOWLEDGE</div>
        <div className="comparison-content">
          <div className="comparison-stat">
            <span>Reports Received</span>
            <span>{comparison.trainee_knowledge.reports_received}</span>
          </div>
          <div className="comparison-subtitle">Communication Status</div>
          {Object.entries(comparison.trainee_knowledge.comm_status).map(([unit, status]) => (
            <div key={unit} className="comparison-stat">
              <span>{unit}</span>
              <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
            </div>
          ))}
          <div className="comparison-subtitle">Reports</div>
          {comparison.trainee_knowledge.reports.slice(-4).map((r, i) => (
            <div key={i} className="comparison-report">
              <div className="report-source">{r.source} — {(r.confidence * 100).toFixed(0)}% conf</div>
              <div className="report-text">{r.content.substring(0, 80)}...</div>
              {r.position && (
                <div className="report-pos">📍 ({r.position.x.toFixed(1)}, {r.position.z.toFixed(1)})</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="comparison-divider">
        <div className="divider-label">VS</div>
      </div>

      <div className="comparison-column">
        <div className="comparison-title truth">🎯 GROUND TRUTH</div>
        <div className="comparison-content">
          <div className="comparison-stat">
            <span>Actual Enemy Count</span>
            <span className="truth-value">{comparison.ground_truth.actual_enemy_count}</span>
          </div>
          <div className="comparison-stat">
            <span>Threat Level</span>
            <span className="truth-value">{comparison.ground_truth.actual_threat_level}</span>
          </div>
          <div className="comparison-subtitle">Hostile Units</div>
          {comparison.ground_truth.hostile_units.map((h, i) => (
            <div key={i} className="comparison-report hostile">
              <div className="report-source">⚠ {h.name}</div>
              <div className="report-text">Type: {h.type} | Strength: {h.strength}</div>
              <div className="report-text">Intent: {h.intent}</div>
              <div className="report-pos">📍 ({h.position.x.toFixed(1)}, {h.position.z.toFixed(1)})</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AARPanel() {
  const score = useGameStore((s) => s.score);
  const comparison = useGameStore((s) => s.comparison);
  const events = useGameStore((s) => s.events);
  const decisions = useGameStore((s) => s.decisions);
  const resetScenario = useGameStore((s) => s.resetScenario);
  const [tab, setTab] = useState('score');

  if (!score) return null;

  const totalColor = score.total >= 80 ? '#4caf50' : score.total >= 60 ? '#ff9800' : '#f44336';

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
        <button className={`aar-tab ${tab === 'score' ? 'active' : ''}`} onClick={() => setTab('score')}>
          📊 Scores
        </button>
        <button className={`aar-tab ${tab === 'comparison' ? 'active' : ''}`} onClick={() => setTab('comparison')}>
          🔍 Knowledge vs Truth
        </button>
        <button className={`aar-tab ${tab === 'timeline' ? 'active' : ''}`} onClick={() => setTab('timeline')}>
          📋 Full Timeline
        </button>
        <button className={`aar-tab ${tab === 'feedback' ? 'active' : ''}`} onClick={() => setTab('feedback')}>
          💡 Feedback
        </button>
      </div>

      <div className="aar-content">
        {tab === 'score' && (
          <div className="score-section">
            <div className="score-gauges">
              <ScoreGauge label="Decision Quality" value={score.decision_quality} weight={30} color="#2196f3" />
              <ScoreGauge label="Response Time" value={score.response_time} weight={20} color="#4caf50" />
              <ScoreGauge label="Uncertainty Handling" value={score.uncertainty_handling} weight={20} color="#ff9800" />
              <ScoreGauge label="Comm Handling" value={score.communication_handling} weight={15} color="#9c27b0" />
              <ScoreGauge label="Resource Mgmt" value={score.resource_management} weight={15} color="#00bcd4" />
            </div>
          </div>
        )}

        {tab === 'comparison' && (
          <ComparisonView comparison={comparison} />
        )}

        {tab === 'timeline' && (
          <div className="aar-timeline">
            {events.map((event, i) => (
              <div key={i} className="aar-timeline-item">
                <div className="aar-tl-dot" />
                <div className="aar-tl-content">
                  <span className="aar-tl-type">{event.event_type}</span>
                  <span className="aar-tl-desc">{event.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'feedback' && (
          <div className="feedback-section">
            <div className="feedback-title">📝 Performance Analysis</div>
            {score.explanations.map((exp, i) => (
              <div key={i} className="feedback-item">
                <div className="feedback-bullet" />
                <div className="feedback-text">{exp}</div>
              </div>
            ))}
            {decisions.length > 0 && (
              <div className="decision-summary">
                <div className="feedback-title">⚡ Decisions Made ({decisions.length} / {useGameStore((s) => s.scenarioState?.config?.max_decisions || 3)})</div>
                {decisions.map((d, i) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div className="decision-badge" style={{ marginBottom: '4px' }}>{i + 1}. {d.decision_type}</div>
                    {d.reasoning && (
                      <div className="decision-reasoning">
                        Reasoning: "{d.reasoning}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="aar-quote">
              "We do not train decisions in perfect information. We train decisions when the information itself becomes the problem."
            </div>
          </div>
        )}
      </div>

      <div className="aar-footer">
        <button className="restart-btn" onClick={resetScenario}>
          🔄 NEW SCENARIO
        </button>
      </div>
    </div>
  );
}
