/* ── Intelligence Feed — incoming message traffic ──────────── */
import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { formatT, gridRef } from '../../utils/format';
import PanelHeader from './PanelHeader';

const GARBLE = '▒▒▒';

/** Render words lost on degraded links as static blocks. */
function Transmission({ text }) {
  if (!text.includes(GARBLE)) return text;
  return text.split(GARBLE).map((part, i, arr) => (
    <React.Fragment key={i}>
      {part}
      {i < arr.length - 1 && <span className="garble" title="Lost in transmission">{GARBLE}</span>}
    </React.Fragment>
  ));
}

const confClass = (c) => (c >= 0.7 ? 'hi' : c >= 0.45 ? 'mid' : 'lo');

export default function IntelFeed() {
  const reports = useGameStore((s) => s.reports);
  const startedAt = useGameStore((s) => s.scenarioState?.started_at);
  const round = useGameStore((s) => s.scenarioState?.round || 1);
  const newestFirst = [...reports].reverse();

  return (
    <section className="panel panel-grow">
      <PanelHeader index="02" title="MESSAGE TRAFFIC" meta={`${reports.length} MSG`} />
      <div className="feed">
        {!reports.length && <div className="empty">Awaiting traffic…</div>}
        {newestFirst.map((r, i) => {
          const body = r.content.replace(/^\[DELAYED \d+s\]\s*/, '');
          const prev = newestFirst[i - 1];
          return (
            <React.Fragment key={r.id}>
              {(!prev || prev.round !== r.round) && <div className="feed-round">ROUND {r.round}</div>}
              <article className={`msg conf-${confClass(r.confidence)} ${r.round < round ? 'stale' : ''}`}>
                <div className="msg-head">
                  <span className="msg-time">{startedAt ? formatT(r.timestamp - startedAt) : ''}</span>
                  <span className="msg-from">{r.source_unit === 'RECON_ASSET' ? 'HAWKEYE' : r.source_unit}</span>
                  <span className="msg-cat">{r.category}</span>
                  {r.delay_s > 0 && <span className="msg-late">+{Math.round(r.delay_s)}s LATE</span>}
                </div>
                <p className="msg-body"><Transmission text={body} /></p>
                <div className="msg-foot">
                  <span className="conf-bar"><i style={{ width: `${r.confidence * 100}%` }} /></span>
                  <span className="msg-conf">CONF {Math.round(r.confidence * 100)}%</span>
                  {r.reported_position && <span className="msg-grid">GRID {gridRef(r.reported_position)}</span>}
                </div>
              </article>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
