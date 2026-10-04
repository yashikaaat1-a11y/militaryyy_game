/* ── TacticalScene — main 3D scene combining all elements ─── */
import React, { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useGameStore } from '../../stores/gameStore';
import Terrain from './Terrain';
import Buildings from './Buildings';
import Roads from './Roads';
import Environment from './Environment';
import CommandCentre from './CommandCentre';
import UnitMarker from './UnitMarker';
import CommLinks from './CommLinks';
import ContactMarker from './ContactMarker';
import Scatter from './Scatter';
import { NatoSymbol } from './NatoSymbol';
import { AssessmentPicker, BeliefPin } from './AssessmentLayer';
import { formatT } from '../../utils/format';

const INFO_CATEGORIES = ['CONTACT', 'SIGINT', 'RECON'];

function Legend({ showTruth }) {
  const row = (swatch, label) => <div className="legend-item">{swatch}<span>{label}</span></div>;
  return (
    <div className="scene-legend">
      <div className="legend-title">LEGEND</div>
      {row(<NatoSymbol affiliation="friendly" type="INFANTRY" size={18} />, 'Friendly unit')}
      {row(<NatoSymbol affiliation="unknown" size={18} />, 'Reported contact')}
      {showTruth && row(<NatoSymbol affiliation="hostile" type="ARMOR" size={18} />, 'Actual enemy')}
      {row(<span className="legend-dot" style={{ background: '#4dd0e1' }} />, 'Your estimate')}
      <div className="legend-sep" />
      {row(<span className="legend-line" style={{ borderColor: '#5fd068' }} />, 'Link normal')}
      {row(<span className="legend-line dashed" style={{ borderColor: '#e8d24a' }} />, 'Delayed')}
      {row(<span className="legend-line dashed" style={{ borderColor: '#f08a2e' }} />, 'Degraded')}
      {row(<span className="legend-line dotted" style={{ borderColor: '#e5483f' }} />, 'Lost')}
    </div>
  );
}

const HOME = new THREE.Vector3(0, 22, 25);

/** Fly the camera in when a scenario starts; drift slowly around the table while idle. */
function CameraRig({ controls }) {
  const scenarioId = useGameStore((s) => s.scenarioState?.id);
  const phase = useGameStore((s) => s.phase);
  const showWelcome = useGameStore((s) => s.showWelcome);
  const { camera } = useThree();
  const flight = useRef(null);

  useEffect(() => {
    if (!scenarioId || showWelcome) return;
    flight.current = { from: new THREE.Vector3(-26, 34, 40), t: 0 };
    camera.position.copy(flight.current.from);
  }, [scenarioId, showWelcome, camera]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (c) c.autoRotate = phase === 'IDLE' || showWelcome;
    const f = flight.current;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / 2.6);
    const e = 1 - Math.pow(1 - f.t, 3); // ease-out
    camera.position.lerpVectors(f.from, HOME, e);
    c?.update();
    if (f.t >= 1) flight.current = null;
  });
  return null;
}

function Effects({ quality }) {
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={1.6} intensity={2.2} distanceFalloff={0.6} halfRes />
      <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.9} luminanceSmoothing={0.15} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.62} />
      <SMAA />
    </EffectComposer>
  );
}

export default function TacticalScene() {
  const liveUnits = useGameStore((s) => s.units);
  const reports = useGameStore((s) => s.reports);
  const phase = useGameStore((s) => s.phase);
  const round = useGameStore((s) => s.scenarioState?.round || 1);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const setSelectedUnit = useGameStore((s) => s.setSelectedUnit);
  const groundTruth = useGameStore((s) => s.groundTruth);
  const replayFrames = useGameStore((s) => s.replayFrames);
  const replayIndex = useGameStore((s) => s.replayIndex);
  const decisions = useGameStore((s) => s.decisions);
  const quality = useGameStore((s) => s.gfxQuality);
  const setGfx = useGameStore((s) => s.setGfxQuality);
  const controls = useRef();

  const frame = phase === 'AAR' && replayIndex !== null ? replayFrames[replayIndex] : null;

  let units, contacts, hostiles;
  if (frame) {
    // AAR replay: show the recorded frame, with ground truth always visible
    units = frame.units;
    contacts = frame.contacts.map((c) => ({
      position: c.position, confidence: c.confidence, label: c.source, isGroundTruth: false,
    }));
    hostiles = frame.hostiles;
  } else {
    units = liveUnits;
    // Only the current round's intelligence is plotted — older reports are stale
    contacts = reports
      .filter((r) => r.reported_position && INFO_CATEGORIES.includes(r.category) && r.round === round)
      .map((r) => ({
        position: r.reported_position,
        confidence: r.confidence,
        label: r.source_unit,
        isGroundTruth: false,
      }));
    const showGroundTruth = phase === 'REVEAL' || phase === 'AAR';
    hostiles = showGroundTruth && groundTruth?.hostile_units ? groundTruth.hostile_units : [];
  }

  // In the AAR replay, show what the commander believed vs what the evidence supported
  const replayDecision = frame && ['DECISION', 'CONSEQUENCE'].includes(frame.phase)
    ? decisions.find((d) => d.round === frame.round)
    : null;

  const hostileMarkers = hostiles.map((h) => ({
    position: h.position,
    confidence: 1,
    label: h.engaged ? `${h.name} (engaged)` : h.name,
    isGroundTruth: true,
  }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={quality === 'low' ? 1 : [1, 1.75]}
        gl={{ antialias: quality === 'low', powerPreference: 'high-performance' }}
        camera={{ position: HOME.toArray(), fov: 42, near: 0.5, far: 200 }}
        style={{ background: '#0b0e10' }}
      >
        {/* Weak GPU? Drop to low graphics automatically rather than stutter in front of the judges */}
        <PerformanceMonitor bounds={() => [28, 60]} flipflops={1} onDecline={() => setGfx('low', true)} />
        <Suspense fallback={null}>
          <Environment />
          <Terrain />
          <Roads />
          <Buildings />
          <Scatter />
          <CommandCentre />

          {/* Friendly units */}
          {units.map((unit) => (
            <UnitMarker
              key={unit.id}
              unit={unit}
              isSelected={selectedUnit?.id === unit.id}
              onClick={setSelectedUnit}
            />
          ))}

          {/* Communication links */}
          {units.length > 0 && <CommLinks units={units} />}

          {/* Reported contacts */}
          {contacts.map((c, i) => (
            <ContactMarker key={`contact-${i}`} {...c} />
          ))}

          {/* Ground truth hostile markers */}
          {hostileMarkers.map((h, i) => (
            <ContactMarker key={`hostile-${i}`} {...h} />
          ))}

          {!frame && <AssessmentPicker />}
          {replayDecision?.assessment && (
            <BeliefPin position={replayDecision.assessment} confidence={replayDecision.assessment.confidence} kind="you" />
          )}
          {replayDecision?.context?.evidence_estimate && (
            <BeliefPin position={replayDecision.context.evidence_estimate} kind="evidence" />
          )}

          <OrbitControls
            ref={controls}
            makeDefault
            enablePan
            enableDamping
            dampingFactor={0.08}
            autoRotateSpeed={0.35}
            maxPolarAngle={Math.PI / 2.35}
            minDistance={8}
            maxDistance={48}
            target={[0, 0, 0]}
          />
          <CameraRig controls={controls} />
        </Suspense>
        {/* Separate boundary: if an effect suspends while loading, the world stays mounted */}
        <Suspense fallback={null}>
          <Effects quality={quality} />
        </Suspense>
      </Canvas>

      {units.length > 0 && <Legend showTruth={hostileMarkers.length > 0} />}
      {frame && (
        <div className="replay-banner">
          ⏪ REPLAY · T+{formatT(frame.t)} · {frame.label}
        </div>
      )}
    </div>
  );
}
