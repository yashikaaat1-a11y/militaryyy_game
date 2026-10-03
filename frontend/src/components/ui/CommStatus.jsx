/* ── Comm Status — communication status overview ───────────── */
import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import './CommStatus.css';

const STATUS_CONFIG = {
  NORMAL: { color: '#4caf50', label: 'ONLINE', bar: 100 },
  DELAYED: { color: '#ffeb3b', label: 'DELAYED', bar: 60 },
  DEGRADED: { color: '#ff9800', label: 'DEGRADED', bar: 35 },
  LOST: { color: '#f44336', label: 'LOST', bar: 0 },
};

export default function CommStatus() {
  const units = useGameStore((s) => s.units);
  const friendlyUnits = units.filter((u) => u.faction === 'FRIENDLY' && u.unit_type !== 'COMMAND');

  return (
    <div className="comm-status">
      <div className="panel-header">
        <span className="panel-icon">📶</span>
        <span>COMM STATUS</span>
      </div>
      <div className="comm-list">
        {friendlyUnits.map((unit) => {
          const cfg = STATUS_CONFIG[unit.comm_status] || STATUS_CONFIG.NORMAL;
          return (
            <div key={unit.id} className="comm-item">
              <div className="comm-unit-info">
                <span className="comm-callsign">{unit.callsign}</span>
                <span className="comm-label" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <div className="comm-bar-track">
                <div
                  className="comm-bar-fill"
                  style={{
                    width: `${cfg.bar}%`,
                    background: cfg.color,
                    boxShadow: cfg.bar > 0 ? `0 0 8px ${cfg.color}` : 'none',
                  }}
                />
              </div>
              {unit.comm_delay_ms > 0 && (
                <div className="comm-delay">+{unit.comm_delay_ms}ms</div>
              )}
            </div>
          );
        })}
        {friendlyUnits.length === 0 && (
          <div className="feed-empty">No units deployed</div>
        )}
      </div>
    </div>
  );
}
