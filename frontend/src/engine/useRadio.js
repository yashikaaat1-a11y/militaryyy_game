/* ── useRadio — feeds newly received reports to the radio ─── */
import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { transmit, stopRadio, setRadioEnabled } from './radio';

const QUIET_PHASES = ['IDLE', 'REVEAL', 'AAR'];

export function useRadio() {
  const radioOn = useGameStore((s) => s.radioOn);

  useEffect(() => {
    setRadioEnabled(radioOn);
  }, [radioOn]);

  useEffect(() => {
    const seen = new Set();
    let scenarioId = null;

    return useGameStore.subscribe((s, prev) => {
      const id = s.scenarioState?.id || null;
      if (id !== scenarioId) {
        // New scenario (or page reload mid-scenario): don't read the backlog
        stopRadio();
        seen.clear();
        if (!prev.scenarioState) s.reports.forEach((r) => seen.add(r.id));
        scenarioId = id;
      }
      if (s.isPaused && !prev.isPaused) stopRadio();
      if (QUIET_PHASES.includes(s.phase)) {
        if (!QUIET_PHASES.includes(prev.phase)) stopRadio();
        s.reports.forEach((r) => seen.add(r.id));
        return;
      }
      const status = Object.fromEntries(s.units.map((u) => [u.callsign, u.comm_status]));
      for (const r of s.reports) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        if (r.category === 'SITREP') continue; // routine traffic stays on the screen only
        transmit(r, status[r.source_unit] === 'DEGRADED' || r.content.includes('▒'));
      }
    });
  }, []);
}
