/* ── Comm Status — link table with signal strength ─────────── */
import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import PanelHeader from './PanelHeader';

const STATUS = {
  NORMAL: { bars: 4, cls: 'ok', label: 'NORMAL' },
  DELAYED: { bars: 3, cls: 'warn', label: 'DELAYED' },
  DEGRADED: { bars: 2, cls: 'deg', label: 'DEGRADED' },
  LOST: { bars: 0, cls: 'bad', label: 'LOST' },
};

function SignalBars({ bars, cls }) {
  return (
    <svg className={`signal ${cls}`} width="22" height="14" viewBox="0 0 22 14">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 5.5} y={10 - i * 3} width="4" height={4 + i * 3} className={i < bars ? 'on' : 'off'} />
      ))}
      {bars === 0 && <path d="M1 1 L21 13 M21 1 L1 13" className="cross" />}
    </svg>
  );
}

export default function CommStatus() {
  const units = useGameStore((s) => s.units);
  const subs = units.filter((u) => u.faction === 'FRIENDLY' && u.unit_type !== 'COMMAND');
  const up = subs.filter((u) => u.comm_status !== 'LOST').length;

  return (
    <section className="panel">
      <PanelHeader index="01" title="COMMS" meta={subs.length ? `${up}/${subs.length} LINKS UP` : ''} />
      <table className="comm-table">
        <tbody>
          {subs.map((u) => {
            const s = STATUS[u.comm_status] || STATUS.NORMAL;
            return (
              <tr key={u.id} className={s.cls}>
                <td className="callsign">{u.callsign}</td>
                <td><SignalBars bars={s.bars} cls={s.cls} /></td>
                <td className="latency">{u.comm_delay_ms ? `+${(u.comm_delay_ms / 1000).toFixed(1)}s` : u.comm_status === 'LOST' ? '—' : '0.0s'}</td>
                <td className={`status ${s.cls}`}>{s.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!subs.length && <div className="empty">No units deployed</div>}
    </section>
  );
}
