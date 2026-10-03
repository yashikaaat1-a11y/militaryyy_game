/* ── Instructor Dashboard — scenario config + monitoring ──── */
import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import './InstructorDashboard.css';

const PRESETS = {
  EASY: { comm_reliability: 0.9, dropout_probability: 0.1, conflicting_report_probability: 0.15, threat_difficulty: 'LOW' },
  MEDIUM: { comm_reliability: 0.7, dropout_probability: 0.25, conflicting_report_probability: 0.35, threat_difficulty: 'MEDIUM' },
  HARD: { comm_reliability: 0.4, dropout_probability: 0.45, conflicting_report_probability: 0.55, threat_difficulty: 'HIGH' },
};

export default function InstructorDashboard() {
  const { phase, units, reports, decisions, events, createScenario, resetScenario, setView, isLoading } = useGameStore();
  const [config, setConfig] = useState({
    name: 'Urban Comms Failure',
    scenario_type: 'URBAN',
    duration_seconds: 300,
    comm_reliability: 0.7,
    dropout_probability: 0.25,
    conflicting_report_probability: 0.35,
    threat_difficulty: 'MEDIUM',
  });
  const [activePreset, setActivePreset] = useState('MEDIUM');

  const applyPreset = (preset) => {
    setActivePreset(preset);
    setConfig((c) => ({ ...c, ...PRESETS[preset] }));
  };

  const handleCreate = async () => {
    await createScenario(config);
    setView('SCENARIO');
  };

  return (
    <div className="instructor-dashboard">
      <div className="inst-header">
        <div className="inst-title">
          <span>🎓</span> INSTRUCTOR DASHBOARD
        </div>
        <button className="back-btn" onClick={() => setView('SCENARIO')}>
          ← Back to Scenario
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
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
              />
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
                  setConfig((c) => ({ ...c, scenario_type: type, name: name }));
                }}
              >
                <option value="URBAN">URBAN</option>
                <option value="MOUNTAIN">MOUNTAIN</option>
                <option value="RIVER">RIVER</option>
                <option value="DESERT">DESERT</option>
              </select>
            </label>
            <label className="config-field">
              <span>Comm Reliability</span>
              <div className="slider-row">
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={config.comm_reliability}
                  onChange={(e) => setConfig((c) => ({ ...c, comm_reliability: parseFloat(e.target.value) }))}
                />
                <span className="slider-value">{(config.comm_reliability * 100).toFixed(0)}%</span>
              </div>
            </label>
            <label className="config-field">
              <span>Dropout Probability</span>
              <div className="slider-row">
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={config.dropout_probability}
                  onChange={(e) => setConfig((c) => ({ ...c, dropout_probability: parseFloat(e.target.value) }))}
                />
                <span className="slider-value">{(config.dropout_probability * 100).toFixed(0)}%</span>
              </div>
            </label>
            <label className="config-field">
              <span>Conflicting Report Prob.</span>
              <div className="slider-row">
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={config.conflicting_report_probability}
                  onChange={(e) => setConfig((c) => ({ ...c, conflicting_report_probability: parseFloat(e.target.value) }))}
                />
                <span className="slider-value">{(config.conflicting_report_probability * 100).toFixed(0)}%</span>
              </div>
            </label>
            <label className="config-field">
              <span>Threat Difficulty</span>
              <select
                value={config.threat_difficulty}
                onChange={(e) => setConfig((c) => ({ ...c, threat_difficulty: e.target.value }))}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </label>
          </div>

          <button className="create-btn" onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'CREATING...' : '🚀 CREATE & START SCENARIO'}
          </button>
        </div>

        {/* Live Monitoring */}
        <div className="inst-card">
          <div className="card-title">📡 LIVE MONITORING</div>

          <div className="monitor-stats">
            <div className="monitor-stat">
              <span className="stat-value">{phase}</span>
              <span className="stat-label">Current Phase</span>
            </div>
            <div className="monitor-stat">
              <span className="stat-value">{units.length}</span>
              <span className="stat-label">Units Deployed</span>
            </div>
            <div className="monitor-stat">
              <span className="stat-value">{reports.length}</span>
              <span className="stat-label">Reports Generated</span>
            </div>
            <div className="monitor-stat">
              <span className="stat-value">{decisions.length}</span>
              <span className="stat-label">Decisions Made</span>
            </div>
            <div className="monitor-stat">
              <span className="stat-value">{events.length}</span>
              <span className="stat-label">Events Logged</span>
            </div>
          </div>

          {units.length > 0 && (
            <div className="unit-monitor">
              <div className="card-subtitle">Unit Status</div>
              {units.filter(u => u.faction === 'FRIENDLY').map((u) => (
                <div key={u.id} className="unit-row">
                  <span className="unit-callsign">{u.callsign}</span>
                  <span className="unit-type">{u.unit_type}</span>
                  <span className={`unit-comm comm-${u.comm_status.toLowerCase()}`}>
                    {u.comm_status}
                  </span>
                  <span className="unit-pos">
                    ({u.position.x.toFixed(1)}, {u.position.z.toFixed(1)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
