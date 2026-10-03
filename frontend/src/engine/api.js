/* ── TactiComm API Client ───────────────────────────────── */

const API_BASE = 'http://localhost:8000';

async function apiCall(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API Error');
  }
  return res.json();
}

export const api = {
  createScenario: (config) =>
    apiCall('/scenario/create', { method: 'POST', body: JSON.stringify(config || {}) }),

  getState: () => apiCall('/scenario/state'),

  advancePhase: () => apiCall('/scenario/advance', { method: 'POST' }),

  makeDecision: (decisionType, reasoning) =>
    apiCall('/scenario/decide', {
      method: 'POST',
      body: JSON.stringify({ decision_type: decisionType, reasoning }),
    }),

  resetScenario: () => apiCall('/scenario/reset', { method: 'POST' }),

  getScore: () => apiCall('/aar/score'),

  getTimeline: () => apiCall('/aar/timeline'),

  getComparison: () => apiCall('/aar/comparison'),

  getInstructorStatus: () => apiCall('/instructor/status'),
};
