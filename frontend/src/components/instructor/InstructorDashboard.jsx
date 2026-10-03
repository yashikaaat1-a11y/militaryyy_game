/* ── Instructor Dashboard — scenario config + live monitoring ── */
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { api } from '../../engine/api';
import { unlockAudio } from '../../engine/radio';
import { formatT, missionTime } from '../../utils/format';
import './InstructorDashboard.css';

const PRESETS = {
  EASY: { comm_reliability: 0.9, dropout_probability: 0.1, conflicting_report_probability: 0.15, threat_difficulty: 'LOW', duration_seconds: 360 },
  MEDIUM: { comm_reliability: 0.7, dropout_probability: 0.25, conflicting_report_probability: 0.35, threat_difficulty: 'MEDIUM', duration_seconds: 300 },
  HARD: { comm_reliability: 0.4, dropout_probability: 0.45, conflicting_report_probability: 0.55, threat_difficulty: 'HIGH', duration_seconds: 180 },
};

function Slider({ label, value, onChange }) {
  return (
    <label className="config-field">
      <span>{label}</span>
      <div className="slider-row">
        <input type="range" min="0" max="1" step="0.05" value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))} />
        <span className="slider-value">{(value * 100).toFixed(0)}%</span>
      </div>
    </label>
  );
}

function NumberSelect({ label, value, options, onChange, format = (v) => v }) {
  return (
    <label className="config-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => <option key={o} value={o}>{format(o)}</option>)}
      </select>
    </label>
  );
}

/** Poll the server directly so this screen works even on a separate machine/tab. */
function useInstructorStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.getInstructorStatus();
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus(null);
      }
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return status;
}

export default function InstructorDashboard() {
  const { createScenario, setPaused, stopScenario, resetScenario, setView, isLoading } = useGameStore();
  const current = useGameStore((s) => s.scenarioState?.config);
  const status = useInstructorStatus();
  // Start from the running scenario's settings so returning here doesn't lose them
  const [config, setConfig] = useState(() => {
    const base = {
      name: 'Urban Comms Failure',
      scenario_type: 'URBAN',
      duration_seconds: 300,
      comm_reliability: 0.7,
      dropout_probability: 0.25,
      conflicting_report_probability: 0.35,
      threat_difficulty: 'MEDIUM',
      num_friendly_units: 3,
      max_decisions: 3,
      recon_assets: 2,
    };
    if (!current) return base;
    return Object.fromEntries(Object.keys(base).map((k) => [k, current[k] ?? base[k]]));
  });
  const [activePreset, setActivePreset] = useState(() => {
    if (!current) return 'MEDIUM';
    return Object.keys(PRESETS).find((p) =>
      Object.entries(PRESETS[p]).every(([k, v]) => current[k] === v)) || null;
  });
  const set = (k) => (v) => setConfig((c) => ({ ...c, [k]: v }));

  const applyPreset = (preset) => {
    setActivePreset(preset);
    setConfig((c) => ({ ...c, ...PRESETS[preset] }));
  };

  const handleCreate = async () => {
    unlockAudio();
    await createScenario(config);
    setView('SCENARIO');
  };

  const active = status && !status.is_complete;
  const friendly = status?.units?.filter((u) => u.faction === 'FRIENDLY') || [];
  const startedAt = status?.started_at;

  return (
    <div className="instructor-dashboard">
      <div className="inst-header">
        <div className="inst-title">
          <span>🎓</span> INSTRUCTOR DASHBOARD
        </div>
        <button className="back-btn" onClick={() => setView('SCENARIO')}>
          ← Trainee View
        </button>
      </div>

      <div className="inst-grid">
        {/* Scenario Configuration */}
        <div className="inst-card">
          <div className="card-title">⚙️ SCENARIO CONFIGURATION</div>

          <div className="preset-row">
            {Object.keys(PRESETS).map((p) => (
              <button
                key={p}
                className={`preset-btn ${activePreset === p ? 'active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="config-fields">
            <label className="config-field">
              <span>Scenario Name</span>
              <input type="text" value={config.name} onChange={(e) => set('name')(e.target.value)} />
            </label>
            <label className="config-field">
              <span>Layout / Terrain</span>
              <select
                value={config.scenario_type}
                onChange={(e) => {
                  const type = e.target.value;
                  const name = type === 'MOUNTAIN' ? 'Mountain Ambush' :
                               type === 'RIVER' ? 'River Patrol' :
                               type === 'DESERT' ? 'Desert Assault' : 'Urban Comms Failure';
                  setConfig((c) => ({ ...c, scenario_type: type, name }));
                }}
              >
                <option value="URBAN">URBAN</option>
                <option value="MOUNTAIN">MOUNTAIN</option>
                <option value="RIVER">RIVER</option>
                <option value="DESERT">DESERT</option>
              </select>
            </label>
            <Slider label="Comm Reliability" value={config.comm_reliability} onChange={set('comm_reliability')} />
            <Slider label="Dropout Probability" value={config.dropout_probability} onChange={set('dropout_probability')} />
            <Slider label="Conflicting Report Prob." value={config.conflicting_report_probability} onChange={set('conflicting_report_probability')} />
            <div className="config-row">
              <label className="config-field">
                <span>Threat Difficulty</span>
                <select value={config.threat_difficulty} onChange={(e) => set('threat_difficulty')(e.target.value)}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </label>
              <NumberSelect label="Scenario Duration" value={config.duration_seconds}
                options={[120, 180, 240, 300, 360, 480, 600]} onChange={set('duration_seconds')}
                format={(v) => `${v / 60} min`} />
            </div>
            <div className="config-row">
              <NumberSelect label="Friendly Units" value={config.num_friendly_units}
                options={[1, 2, 3]} onChange={set('num_friendly_units')} />
              <NumberSelect label="Decision Points" value={config.max_decisions}
                options={[1, 2, 3, 4, 5]} onChange={set('max_decisions')} />
              <NumberSelect label="Recon Assets" value={config.recon_assets}
                options={[0, 1, 2, 3]} onChange={set('recon_assets')} />
            </div>
          </div>

          <button className="create-btn" onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'CREATING...' : '🚀 CREATE & START SCENARIO'}
          </button>
        </div>

        {/* Live Monitoring */}
        <div className="inst-card">
          <div className="card-title">
            📡 LIVE MONITORING
            {status && <span className={`live-dot ${status.is_paused ? 'paused' : active ? 'on' : ''}`} />}
          </div>

          {!status ? (
            <div className="inst-empty">No active scenario. Configure and start one on the left.</div>
          ) : (
            <>
              <div className="control-row">
                {status.is_paused ? (
                  <button className="ctl-btn resume" disabled={!active} onClick={() => setPaused(false)}>▶ RESUME</button>
                ) : (
                  <button className="ctl-btn pause" disabled={!active} onClick={() => setPaused(true)}>⏸ PAUSE</button>
                )}
                <button className="ctl-btn stop" disabled={!active} onClick={stopScenario}>⏹ STOP &amp; REVIEW</button>
                <button className="ctl-btn" onClick={resetScenario}>✕ RESET</button>
              </div>

              <div className="monitor-stats">
                <div className="monitor-stat">
                  <span className="stat-value">{status.is_paused ? 'PAUSED' : status.phase}</span>
                  <span className="stat-label">Phase · Round {status.round}</span>
                </div>
                <div className="monitor-stat">
                  <span className="stat-value">{formatT(status.elapsed)}</span>
                  <span className="stat-label">Elapsed</span>
                </div>
                <div className="monitor-stat">
                  <span className="stat-value">{status.decisions_made} / {status.config.max_decisions}</span>
                  <span className="stat-label">Decisions</span>
                </div>
                <div className="monitor-stat">
                  <span className="stat-value">{status.reports_generated}</span>
                  <span className="stat-label">Reports</span>
                </div>
                <div className="monitor-stat">
                  <span className="stat-value">{status.recon_remaining}</span>
                  <span className="stat-label">Recon Left</span>
                </div>
                <div className="monitor-stat">
                  <span className="stat-value">{status.live_score ? status.live_score.total.toFixed(0) : '—'}</span>
                  <span className="stat-label">Live Score</span>
                </div>
              </div>

              <div className="unit-monitor">
                <div className="card-subtitle">Unit Status</div>
                {friendly.map((u) => (
                  <div key={u.id} className="unit-row">
                    <span className="unit-callsign">{u.callsign}</span>
                    <span className="unit-type">{u.unit_type}</span>
                    <span className={`unit-comm comm-${u.comm_status.toLowerCase()}`}>
                      {u.comm_status}{u.comm_delay_ms ? ` +${(u.comm_delay_ms / 1000).toFixed(1)}s` : ''}
                    </span>
                    <span className="unit-health">{u.health.toFixed(0)}%</span>
                    <span className="unit-pos">({u.position.x.toFixed(1)}, {u.position.z.toFixed(1)})</span>
                  </div>
                ))}
              </div>

              <div className="unit-monitor">
                <div className="card-subtitle">Ground Truth (hidden from trainee)</div>
                {status.ground_truth.hostile_units.map((h) => (
                  <div key={h.id} className="unit-row hostile-row">
                    <span className="unit-callsign">{h.name}</span>
                    <span className="unit-type">{h.strength} {h.type}</span>
                    <span className={`unit-comm ${h.engaged ? 'comm-normal' : 'comm-lost'}`}>{h.engaged ? 'ENGAGED' : h.intent}</span>
                    <span className="unit-pos">({h.position.x.toFixed(1)}, {h.position.z.toFixed(1)})</span>
                  </div>
                ))}
                <div className="inst-note">{status.ground_truth.dropped_reports.length} report(s) dropped in transit so far.</div>
              </div>

              <div className="unit-monitor">
                <div className="card-subtitle">Trainee Decisions</div>
                {status.decisions.length === 0 && <div className="inst-note">None yet.</div>}
                {status.decisions.map((d) => (
                  <div key={d.index} className="decision-log">
                    <div>
                      <b>{d.index}. {d.decision_type.replace('_', ' ')}</b>
                      <span className="inst-note"> · round {d.round} · T+{formatT(d.t)} · took {d.wait_s?.toFixed(0)}s</span>
                      {status.live_score?.decision_reviews?.[d.index - 1] && (
                        <span className="inst-note"> · {status.live_score.decision_reviews[d.index - 1].total.toFixed(0)}/100</span>
                      )}
                    </div>
                    {d.reasoning && <div className="inst-note">“{d.reasoning}”</div>}
                  </div>
                ))}
              </div>

              <div className="unit-monitor">
                <div className="card-subtitle">Recent Events</div>
                {status.recent_events.slice().reverse().map((e) => (
                  <div key={e.id} className="event-row">
                    <span className="event-time">{missionTime(e.timestamp, startedAt)}</span>
                    <span className="event-type">{e.event_type}</span>
                    <span className="event-desc">{e.description}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
