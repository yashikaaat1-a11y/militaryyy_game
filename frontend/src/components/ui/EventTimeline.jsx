/* ── Event Timeline — chronological list of scenario events ── */
import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { missionTime } from '../../utils/format';
import './EventTimeline.css';

const EVENT_ICONS = {
  SCENARIO_CREATED: '🎬',
  PHASE_CHANGE: '📍',
  COMM_CHANGE: '📶',
  DECISION_REQUIRED: '🎯',
  DECISION: '⚡',
  CONSEQUENCE: '💥',
  GROUND_TRUTH_REVEALED: '🔍',
  THREAT_CONTACT: '🚨',
  INSTRUCTOR: '🎓',
};

const EVENT_COLORS = {
  SCENARIO_CREATED: '#58a6ff',
  PHASE_CHANGE: '#bc8cff',
  COMM_CHANGE: '#ff9800',
  DECISION_REQUIRED: '#e91e63',
  DECISION: '#4caf50',
  CONSEQUENCE: '#f44336',
  GROUND_TRUTH_REVEALED: '#00bcd4',
  THREAT_CONTACT: '#ff1744',
  INSTRUCTOR: '#d29922',
};

export default function EventTimeline() {
  const events = useGameStore((s) => s.events);
  const startedAt = useGameStore((s) => s.scenarioState?.started_at);
  const listRef = useRef();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="event-timeline">
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        <span>EVENT TIMELINE</span>
        <span className="report-count">{events.length}</span>
      </div>
      <div className="timeline-list" ref={listRef}>
        {events.length === 0 ? (
          <div className="feed-empty">No events yet...</div>
        ) : (
          events.map((event, i) => (
            <div key={event.id || i} className="timeline-item">
              <div className="timeline-dot" style={{ background: EVENT_COLORS[event.event_type] || '#555' }} />
              <div className="timeline-content">
                <div className="timeline-header">
                  <span>{EVENT_ICONS[event.event_type] || '📄'}</span>
                  <span className="timeline-type" style={{ color: EVENT_COLORS[event.event_type] || '#8b949e' }}>
                    {event.event_type}
                  </span>
                  <span className="timeline-time">{missionTime(event.timestamp, startedAt)}</span>
                </div>
                <div className="timeline-desc">{event.description}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
