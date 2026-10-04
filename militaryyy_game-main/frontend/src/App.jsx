/* ── TactiComm — Main Application ──────────────────────────── */
import React, { useEffect, useState } from 'react';
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
import { formatT } from './utils/format';
import './App.css';

function ClassificationBanner() {
  return <div className="classification">UNCLASSIFIED // FOR TRAINING USE ONLY</div>;
}

function WelcomeScreen() {
  const createScenario = useGameStore((s) => s.createScenario);
  const setView = useGameStore((s) => s.setView);
  const isLoading = useGameStore((s) => s.isLoading);
  const start = () => { unlockAudio(); createScenario(); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Enter') start(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="welcome">
      <div className="welcome-panel">
        <div className="welcome-kicker">SIH 2026 · PS SIH26248 · MINISTRY OF DEFENCE / DSSC</div>
        <h1 className="welcome-title">TACTICOMM</h1>
        <div className="welcome-sub">Decision-making trainer for degraded communication environments</div>

        <p className="welcome-desc">
          Communications fail, reports arrive late or contradict each other, and the clock keeps running.
          Every order is judged on what the commander knew at that moment, and so is what they believed.
        </p>

        <ol className="welcome-points">
          <li><span>01</span>Comms degrade live: delay, dropout, garbled traffic, lost units</li>
          <li><span>02</span>Commander states a belief before each order; biases and calibration are measured</li>
          <li><span>03</span>After action review replays every alternative from the same moment</li>
        </ol>

        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={start} disabled={isLoading}>
            {isLoading ? 'INITIALISING…' : 'BEGIN EXERCISE'} <kbd>ENTER</kbd>
          </button>
          <button className="btn btn-ghost" onClick={() => setView('INSTRUCTOR')}>
            INSTRUCTOR CONSOLE
          </button>
        </div>

        <div className="welcome-meta">
          <div><span>EXERCISE</span>URBAN COMMS FAILURE</div>
          <div><span>DECISION POINTS</span>3</div>
          <div><span>DURATION</span>≈ 5 MIN</div>
        </div>
      </div>
    </div>
  );
}

/** Mission clock: elapsed exercise time, frozen while paused. */
function MissionClock() {
  const state = useGameStore((s) => s.scenarioState);
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 500);
    return () => clearInterval(t);
  }, []);
  if (!state) return <span className="clock">T+0:00</span>;
  const end = state.is_paused && state.paused_at ? state.paused_at : now;
  const elapsed = state.phase === 'AAR' ? state.elapsed_time : end - state.started_at - state.paused_total;
  return <span className="clock">T+{formatT(elapsed)}</span>;
}

function TopBar({ showAAR }) {
  const phase = useGameStore((s) => s.phase);
  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const state = useGameStore((s) => s.scenarioState);
  const radioOn = useGameStore((s) => s.radioOn);
  const toggleRadio = useGameStore((s) => s.toggleRadio);
  const gfx = useGameStore((s) => s.gfxQuality);
  const toggleGfx = useGameStore((s) => s.toggleGfx);
  const cfg = state?.config;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="wordmark">TACTICOMM</span>
        <span className="topbar-ex">
          <span>{cfg?.name?.toUpperCase() || 'NO EXERCISE'}</span>
          {cfg && <span className="dim">{cfg.scenario_type} · {cfg.threat_difficulty}</span>}
        </span>
      </div>

      <div className="topbar-center">
        <PhaseIndicator />
      </div>

      <div className="topbar-right">
        <div className="topbar-clock">
          <MissionClock />
          {state && <span className="dim">RND {state.round}/{cfg.max_decisions}</span>}
        </div>
        <button className={`toggle ${radioOn ? 'on' : ''}`} onClick={() => { unlockAudio(); toggleRadio(); }} title="Spoken radio traffic">
          RADIO <b>{radioOn ? 'ON' : 'OFF'}</b>
        </button>
        <button className={`toggle ${gfx === 'high' ? 'on' : ''}`} onClick={toggleGfx} title="Graphics quality — use LO on slower laptops">
          GFX <b>{gfx === 'high' ? 'HI' : 'LO'}</b>
        </button>
        <nav className="tabs">
          <button className={!showAAR && view !== 'INSTRUCTOR' ? 'active' : ''} onClick={() => setView('SCENARIO')}>MAP</button>
          <button className={showAAR ? 'active' : ''} onClick={() => setView('AAR')} disabled={phase !== 'AAR'}>AAR</button>
          <button onClick={() => setView('INSTRUCTOR')}>INSTRUCTOR</button>
        </nav>
      </div>
    </header>
  );
}

function ScenarioView() {
  const phase = useGameStore((s) => s.phase);
  const view = useGameStore((s) => s.view);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  const isPaused = useGameStore((s) => s.isPaused);

  const showAAR = view === 'AAR' || phase === 'AAR';

  return (
    <div className="layout">
      <TopBar showAAR={showAAR} />

      {error && (
        <div className="toast" onClick={clearError}>
          <b>ERROR</b> {error} <span className="dim">· click to dismiss</span>
        </div>
      )}

      {/* The 3D scene stays mounted; only the right panel changes */}
      <div className="main">
        <div className="scene">
          <TacticalScene />
          {isPaused && (
            <div className="paused">
              <div className="paused-title">EXERCISE PAUSED</div>
              <div className="paused-sub">Instructor hold — stand by</div>
            </div>
          )}
        </div>

        {showAAR ? (
          <aside className="aar-dock"><AARPanel /></aside>
        ) : (
          <aside className="sidebar">
            <CommStatus />
            <IntelFeed />
            <DecisionControls />
            <EventTimeline />
          </aside>
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
    <div className="app">
      <ClassificationBanner />
      <div className="app-body">
        <ScenarioView />
        {phase === 'IDLE' && view !== 'INSTRUCTOR' && <WelcomeScreen />}
        {view === 'INSTRUCTOR' && (
          <div className="screen-overlay"><InstructorDashboard /></div>
        )}
      </div>
    </div>
  );
}
