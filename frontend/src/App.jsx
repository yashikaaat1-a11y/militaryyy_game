/* ── TactiComm — Main Application ──────────────────────────── */
import React from 'react';
import { useGameStore } from './stores/gameStore';
import TacticalScene from './components/scene/TacticalScene';
import PhaseIndicator from './components/ui/PhaseIndicator';
import IntelFeed from './components/ui/IntelFeed';
import DecisionControls from './components/ui/DecisionControls';
import EventTimeline from './components/ui/EventTimeline';
import CommStatus from './components/ui/CommStatus';
import AARPanel from './components/aar/AARPanel';
import InstructorDashboard from './components/instructor/InstructorDashboard';
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
            onClick={() => createScenario()}
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

      {/* Main content */}
      <div className="main-content">
        {showAAR ? (
          <div className="aar-layout">
            <div className="aar-scene">
              <TacticalScene />
            </div>
            <div className="aar-panel-container">
              <AARPanel />
            </div>
          </div>
        ) : (
          <>
            {/* 3D Scene (center) */}
            <div className="scene-container">
              <TacticalScene />
            </div>

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

  if (view === 'INSTRUCTOR') {
    return <InstructorDashboard />;
  }

  if (phase === 'IDLE') {
    return <WelcomeScreen />;
  }

  return <ScenarioView />;
}
