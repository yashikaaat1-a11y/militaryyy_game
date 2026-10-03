/* ── TactiComm API Client ───────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

async function apiCall(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const e = new Error(err.detail || 'API Error');
    e.status = res.status;
    throw e;
  }
  return res.json();
}

const post = (endpoint, body) =>
  apiCall(endpoint, { method: 'POST', body: JSON.stringify(body || {}) });

export const api = {
  createScenario: (config) => post('/scenario/create', config),

  getState: () => apiCall('/scenario/state'),

  advancePhase: () => post('/scenario/advance'),

  makeDecision: (decisionType, reasoning) =>
    post('/scenario/decide', { decision_type: decisionType, reasoning }),

  setPaused: (paused) => post('/scenario/pause', { paused }),

  stopScenario: () => post('/scenario/stop'),

  resetScenario: () => post('/scenario/reset'),

  getScore: () => apiCall('/aar/score'),

  getTimeline: () => apiCall('/aar/timeline'),

  getComparison: () => apiCall('/aar/comparison'),

  getReplay: () => apiCall('/aar/replay'),

  getReport: () => apiCall('/aar/report'),

  getInstructorStatus: () => apiCall('/instructor/status'),
};
