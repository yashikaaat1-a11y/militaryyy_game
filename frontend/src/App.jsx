/* ── TactiComm — Main Application ──────────────────────────── */
import React, { useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import TacticalScene from './components/scene/TacticalScene';
import PhaseIndicator from './components/ui/PhaseIndicator';
import IntelFeed from './components/ui/IntelFeed';
import DecisionControls from './components/ui/DecisionControls';
import EventTimeline from './components/ui/EventTimeline';
import CommStatus from './components/ui/CommStatus';
import AARPanel from './components/aar/AARPanel';
import InstructorDashboard from './components/instructor/InstructorDashboard';
import { useRadio } from './engine/useRadio';
import { unlockAudio } from './engine/radio';
import './App.css';

function WelcomeScreen() {
  const createScenario = useGameStore((s) => s.createScenario);
  const setView = useGameStore((s) => s.setView);
  const isLoading = useGameStore((s) => s.isLoading);

  return (
    <div className="welcome-screen">
      <div className="welcome-bg" />
      <div className="welcome-content">
        <div className="welcome-badge">MINISTRY OF DEFENCE</div>
        <h1 className="welcome-title">
          <span className="title-accent">TACTI</span>COMM
        </h1>
        <p className="welcome-subtitle">
          Multi-Domain Decision-Making Trainer<br />
          for Degraded Communication Environments
        </p>
        <div className="welcome-divider" />
        <p className="welcome-desc">
          Train commanders to make critical decisions when communications fail,
          information conflicts, and uncertainty is the only certainty.
        </p>
        <div className="welcome-actions">
          <button
            className="welcome-btn primary"
            onClick={() => { unlockAudio(); createScenario(); }}
            disabled={isLoading}
          >
            {isLoading ? 'INITIALIZING...' : '🎯 START SCENARIO'}
          </button>
          <button
            className="welcome-btn secondary"
            onClick={() => setView('INSTRUCTOR')}
          >
            🎓 INSTRUCTOR MODE
          </button>
        </div>
        <div className="welcome-scenario-name">
          <span>SCENARIO:</span> Urban Comms Failure
        </div>
      </div>
    </div>
  );
}

function ScenarioView() {
  const phase = useGameStore((s) => s.phase);
  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  const isPaused = useGameStore((s) => s.isPaused);
  const radioOn = useGameStore((s) => s.radioOn);
  const toggleRadio = useGameStore((s) => s.toggleRadio);

  const showAAR = view === 'AAR' || phase === 'AAR';

  return (
    <div className="scenario-layout">
      {/* Top bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="logo-text">
            <span className="logo-accent">TACTI</span>COMM
          </span>
          <span className="logo-separator">|</span>
          <span className="logo-version">v1.0 PROTOTYPE</span>
        </div>
        <div className="top-bar-center">
          <PhaseIndicator />
        </div>
        <div className="top-bar-right">
          <button
            className={`nav-btn radio-btn ${radioOn ? 'active' : ''}`}
            onClick={() => { unlockAudio(); toggleRadio(); }}
            title="Hear incoming radio traffic"
          >
            📻 RADIO {radioOn ? 'ON' : 'OFF'}
          </button>
          <button
            className={`nav-btn ${view === 'SCENARIO' ? 'active' : ''}`}
            onClick={() => setView('SCENARIO')}
          >
            🗺️ MAP
          </button>
          <button
            className={`nav-btn ${view === 'AAR' ? 'active' : ''}`}
            onClick={() => setView('AAR')}
            disabled={phase !== 'AAR'}
          >
            📊 AAR
          </button>
          <button
            className="nav-btn"
            onClick={() => setView('INSTRUCTOR')}
          >
            🎓 INSTRUCTOR
          </button>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="error-toast" onClick={clearError}>
          ⚠️ {error} <span className="error-dismiss">✕</span>
        </div>
      )}

      {/* Main content — the 3D scene stays mounted; only the right panel changes */}
      <div className="main-content">
        <div className="scene-container">
          <TacticalScene />
          {isPaused && (
            <div className="paused-overlay">
              <div className="paused-title">⏸ PAUSED BY INSTRUCTOR</div>
              <div className="paused-sub">Stand by for orders</div>
            </div>
          )}
        </div>

        {showAAR ? (
          <div className="aar-panel-container">
            <AARPanel />
          </div>
        ) : (
          <>
            {/* Right sidebar */}
            <div className="right-sidebar">
              <div className="sidebar-section comm-section">
                <CommStatus />
              </div>
              <div className="sidebar-section intel-section">
                <IntelFeed />
              </div>
              <div className="sidebar-section decision-section">
                <DecisionControls />
              </div>
              <div className="sidebar-section timeline-section">
                <EventTimeline />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const view = useGameStore((s) => s.view);
  const startPolling = useGameStore((s) => s.startPolling);
  const stopPolling = useGameStore((s) => s.stopPolling);
  useRadio();

  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  // The 3D scene is mounted once and never torn down — tearing down the canvas
  // breaks drei's <Html> labels. Welcome and instructor screens are overlays.
  return (
    <>
      <ScenarioView />
      {phase === 'IDLE' && view !== 'INSTRUCTOR' && (
        <div className="screen-overlay"><WelcomeScreen /></div>
      )}
      {view === 'INSTRUCTOR' && (
        <div className="screen-overlay"><InstructorDashboard /></div>
      )}
    </>
  );
}
