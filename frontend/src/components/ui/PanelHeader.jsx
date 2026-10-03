/* ── Panel header — "01  COMMS ............ meta" ───────────── */
import React from 'react';

export default function PanelHeader({ index, title, meta, children }) {
  return (
    <div className="panel-head">
      <span className="panel-index">{index}</span>
      <span className="panel-title">{title}</span>
      <span className="panel-rule" />
      {meta && <span className="panel-meta">{meta}</span>}
      {children}
    </div>
  );
}
