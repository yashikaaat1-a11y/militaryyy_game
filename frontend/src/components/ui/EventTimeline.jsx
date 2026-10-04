/* ── Event Log — chronological exercise log ─────────────────── */
import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { formatT } from '../../utils/format';
import PanelHeader from './PanelHeader';

const TAGS = {
  SCENARIO_CREATED: ['INIT', ''],
  PHASE_CHANGE: ['PHASE', 'dim'],
  COMM_CHANGE: ['COMMS', 'warn'],
  DECISION_REQUIRED: ['DEC REQ', 'accent'],
  DECISION: ['ORDER', 'ok'],
  CONSEQUENCE: ['RESULT', 'info'],
  THREAT_CONTACT: ['CONTACT', 'bad'],
  GROUND_TRUTH_REVEALED: ['TRUTH', 'info'],
  INSTRUCTOR: ['INSTR', 'accent'],
};

export default function EventTimeline() {
  const events = useGameStore((s) => s.events);
  const startedAt = useGameStore((s) => s.scenarioState?.started_at);
  const listRef = useRef();

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [events.length]);

  return (
    <section className="panel panel-log">
      <PanelHeader index="04" title="EVENT LOG" meta={`${events.length}`} />
      <div className="log" ref={listRef}>
        {!events.length && <div className="empty">No events yet</div>}
        {events.map((e, i) => {
          const [tag, cls] = TAGS[e.event_type] || [e.event_type, ''];
          return (
            <div key={e.id || i} className="log-line">
              <span className="log-time">{startedAt ? formatT(e.timestamp - startedAt) : ''}</span>
              <span className={`log-tag ${cls}`}>{tag}</span>
              <span className="log-text">{e.description}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
