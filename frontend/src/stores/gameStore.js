/* ── TactiComm Zustand Store ─────────────────────────────── */
import { create } from 'zustand';
import { api } from '../engine/api';

export const useGameStore = create((set, get) => ({
  // ── State ──
  scenarioState: null,
  phase: 'IDLE',         // IDLE | BRIEFING | NORMAL | DEGRADATION | CONFLICTING | DECISION | CONSEQUENCE | REVEAL | AAR
  units: [],
  reports: [],
  events: [],
  decisions: [],
  score: null,
  comparison: null,
  timeline: null,
  isLoading: false,
  error: null,
  view: 'SCENARIO',      // SCENARIO | AAR | INSTRUCTOR
  selectedUnit: null,
  replayProgress: 0,
  groundTruth: null,

  // ── Actions ──
  setView: (view) => set({ view }),
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  setReplayProgress: (p) => set({ replayProgress: p }),
  clearError: () => set({ error: null }),

  createScenario: async (config) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.createScenario(config);
      const state = res.state;
      set({
        scenarioState: state,
        phase: state.phase,
        units: state.units,
        reports: state.reports,
        events: state.events,
        decisions: state.decisions,
        groundTruth: state.ground_truth,
        score: null,
        comparison: null,
        isLoading: false,
      });
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  advancePhase: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.advancePhase();
      const state = res.state;
      set({
        scenarioState: state,
        phase: state.phase,
        units: state.units,
        reports: state.reports,
        events: state.events,
        decisions: state.decisions,
        score: state.score,
        isLoading: false,
      });

      // If we hit AAR phase, fetch comparison and timeline
      if (state.phase === 'AAR') {
        const comp = await api.getComparison();
        const tl = await api.getTimeline();
        set({ comparison: comp, timeline: tl, view: 'AAR' });
      }
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  makeDecision: async (decisionType, reasoning) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.makeDecision(decisionType, reasoning);
      const state = res.state;
      set({
        scenarioState: state,
        phase: state.phase,
        units: state.units,
        reports: state.reports,
        events: state.events,
        decisions: state.decisions,
        isLoading: false,
      });
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  resetScenario: async () => {
    try {
      await api.resetScenario();
      set({
        scenarioState: null,
        phase: 'IDLE',
        units: [],
        reports: [],
        events: [],
        decisions: [],
        score: null,
        comparison: null,
        timeline: null,
        error: null,
        view: 'SCENARIO',
        selectedUnit: null,
        replayProgress: 0,
        groundTruth: null,
      });
    } catch (e) {
      set({ error: e.message });
    }
  },
}));
