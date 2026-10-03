/* ── TactiComm Zustand Store ─────────────────────────────── */
import { create } from 'zustand';
import { api } from '../engine/api';

const EMPTY = {
  scenarioState: null,
  phase: 'IDLE',         // IDLE | BRIEFING | NORMAL | DEGRADATION | CONFLICTING | DECISION | CONSEQUENCE | REVEAL | AAR
  units: [],
  reports: [],
  events: [],
  decisions: [],
  score: null,
  comparison: null,
  timeline: null,
  replayFrames: [],
  replayIndex: null,     // null = live view; number = replay frame shown in the 3D scene
  groundTruth: null,
  isPaused: false,
  assessment: null,      // commander's belief pin {x, z} for the pending decision
  assessConfidence: 0.5,
};

let pollTimer = null;

export const useGameStore = create((set, get) => ({
  ...EMPTY,
  isLoading: false,
  error: null,
  view: 'SCENARIO',      // SCENARIO | AAR | INSTRUCTOR
  selectedUnit: null,
  gfxQuality: (() => {
    try { return localStorage.getItem('tacticomm.gfx') || 'high'; } catch { return 'high'; }
  })(),
  radioOn: (() => {
    try { return localStorage.getItem('tacticomm.radio') !== 'off'; } catch { return true; }
  })(),

  // ── Actions ──
  setView: (view) => set({ view }),
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  setReplayIndex: (i) => set((s) => ({ replayIndex: typeof i === 'function' ? i(s.replayIndex ?? 0) : i })),
  clearError: () => set({ error: null }),
  setAssessment: (pos) => set({ assessment: pos }),
  setGfxQuality: (q, auto = false) => {
    if (get().gfxQuality === q) return;
    if (!auto) {
      try { localStorage.setItem('tacticomm.gfx', q); } catch { /* storage unavailable */ }
    }
    set({ gfxQuality: q });
  },
  toggleGfx: () => set((s) => {
    const next = s.gfxQuality === 'high' ? 'low' : 'high';
    try { localStorage.setItem('tacticomm.gfx', next); } catch { /* storage unavailable */ }
    return { gfxQuality: next };
  }),
  toggleRadio: () => set((s) => {
    try { localStorage.setItem('tacticomm.radio', s.radioOn ? 'off' : 'on'); } catch { /* storage unavailable */ }
    return { radioOn: !s.radioOn };
  }),
  setAssessConfidence: (c) => set({ assessConfidence: c }),

  /** Apply a server state snapshot to the store. */
  applyState: async (state) => {
    const prevPhase = get().phase;
    set({
      scenarioState: state,
      phase: state.phase,
      units: state.units,
      reports: state.reports,
      events: state.events,
      decisions: state.decisions,
      score: state.score,
      groundTruth: state.ground_truth,
      isPaused: state.is_paused,
    });

    // Entering the AAR: pull the full review data once
    if (state.phase === 'AAR' && prevPhase !== 'AAR') {
      const [comparison, timeline, replay] = await Promise.all([
        api.getComparison(), api.getTimeline(), api.getReplay(),
      ]);
      set({ comparison, timeline, replayFrames: replay.frames, replayIndex: 0, view: 'AAR' });
    }
  },

  /** Poll the server so instructor pause/stop (possibly from another screen) shows up live. */
  startPolling: () => {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      if (get().isLoading) return;
      try {
        const state = await api.getState();
        if (!state) {
          if (get().phase !== 'IDLE') set({ ...EMPTY });
          return;
        }
        const cur = get().scenarioState;
        if (!cur || state.id !== cur.id || state.phase !== cur.phase || state.is_paused !== cur.is_paused
            || state.events.length !== cur.events.length) {
          await get().applyState(state);
        }
      } catch {
        // API briefly unreachable — keep the last known state
      }
    }, 2000);
  },

  stopPolling: () => {
    clearInterval(pollTimer);
    pollTimer = null;
  },

  run: async (fn) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fn();
      if (res?.state) await get().applyState(res.state);
      set({ isLoading: false });
      return res;
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  createScenario: async (config) => {
    set({ ...EMPTY });
    await get().run(() => api.createScenario(config));
    get().startPolling();
  },

  advancePhase: () => get().run(() => api.advancePhase()),

  makeDecision: async (decisionType, reasoning) => {
    const { assessment, assessConfidence } = get();
    const a = assessment ? { ...assessment, confidence: assessConfidence } : null;
    const res = await get().run(() => api.makeDecision(decisionType, reasoning, a));
    if (res) set({ assessment: null, assessConfidence: 0.5 });
    return res;
  },

  setPaused: (paused) => get().run(() => api.setPaused(paused)),

  stopScenario: () => get().run(() => api.stopScenario()),

  exportReport: async () => {
    try {
      return await api.getReport();
    } catch (e) {
      set({ error: e.message });
      return null;
    }
  },

  resetScenario: async () => {
    try {
      await api.resetScenario();
      set({ ...EMPTY, error: null, view: 'SCENARIO', selectedUnit: null });
    } catch (e) {
      set({ error: e.message });
    }
  },
}));
