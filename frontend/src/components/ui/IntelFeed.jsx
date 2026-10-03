/* ── Intelligence Feed — incoming reports with confidence ──── */
import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { missionTime } from '../../utils/format';
import './IntelFeed.css';

const CATEGORY_ICONS = {
  SITREP: '📡',
  CONTACT: '🔴',
  COMM: '📶',
  SIGINT: '🎧',
  RECON: '🛩️',
};

const GARBLE = '▒▒▒';

/** Render lost words from degraded links as static blocks. */
function Transmission({ text }) {
  if (!text.includes(GARBLE)) return text;
  return text.split(GARBLE).map((part, i, arr) => (
    <React.Fragment key={i}>
      {part}
      {i < arr.length - 1 && <span className="garble" title="Lost in transmission">{GARBLE}</span>}
    </React.Fragment>
  ));
}

function ConfidenceBar({ value }) {
  const color = value > 0.7 ? '#4caf50' : value > 0.4 ? '#ff9800' : '#f44336';
  return (
    <div className="confidence-bar">
      <div className="confidence-fill" style={{ width: `${value * 100}%`, background: color }} />
      <span className="confidence-text">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function IntelFeed() {
  const reports = useGameStore((s) => s.reports);
  const startedAt = useGameStore((s) => s.scenarioState?.started_at);
  const round = useGameStore((s) => s.scenarioState?.round || 1);
  const feedRef = useRef();

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [reports.length]);

  return (
    <div className="intel-feed">
      <div className="panel-header">
        <span className="panel-icon">📨</span>
        <span>INTELLIGENCE FEED</span>
        <span className="report-count">{reports.length}</span>
      </div>
      <div className="feed-list" ref={feedRef}>
        {reports.length === 0 ? (
          <div className="feed-empty">Awaiting intelligence reports...</div>
        ) : (
          reports.map((report, i) => (
            <div key={report.id || i} className={`feed-item ${report.confidence < 0.5 ? 'low-confidence' : ''} ${report.round < round ? 'stale' : ''}`}>
              <div className="feed-header">
                <span className="feed-source">
                  {CATEGORY_ICONS[report.category] || '📄'} {report.source_unit}
                </span>
                <span className="feed-category">{report.category}</span>
              </div>
              <div className="feed-meta">
                <span>R{report.round} · obs {missionTime(report.timestamp, startedAt)}</span>
                {report.delay_s > 0 && <span className="feed-delay">received {report.delay_s.toFixed(0)}s late</span>}
              </div>
              <div className="feed-content"><Transmission text={report.content} /></div>
              <div className="feed-footer">
                <ConfidenceBar value={report.confidence} />
                {report.reported_position && (
                  <span className="feed-position">
                    📍 ({report.reported_position.x.toFixed(1)}, {report.reported_position.z.toFixed(1)})
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
