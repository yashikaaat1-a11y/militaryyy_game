/* ── TacticalScene — main 3D scene combining all elements ─── */
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGameStore } from '../../stores/gameStore';
import Terrain from './Terrain';
import Buildings from './Buildings';
import Roads from './Roads';
import Environment from './Environment';
import CommandCentre from './CommandCentre';
import UnitMarker from './UnitMarker';
import CommLinks from './CommLinks';
import ContactMarker from './ContactMarker';
import { AssessmentPicker, BeliefPin } from './AssessmentLayer';
import { formatT } from '../../utils/format';

const INFO_CATEGORIES = ['CONTACT', 'SIGINT', 'RECON'];

function Legend({ showTruth }) {
  const item = (swatch, label) => (
    <div className="legend-item">{swatch}<span>{label}</span></div>
  );
  return (
    <div className="scene-legend">
      {item(<span className="legend-swatch" style={{ background: '#2196f3' }} />, 'Friendly unit')}
      {item(<span className="legend-swatch diamond" style={{ borderColor: '#ff9800' }} />, 'Reported contact (? = confidence)')}
      {item(<span className="legend-swatch" style={{ background: '#4dd0e1', borderRadius: '50%' }} />, 'Your threat estimate')}
      {showTruth && item(<span className="legend-swatch diamond solid" style={{ background: '#f44336' }} />, 'Actual enemy (ground truth)')}
      <div className="legend-sep" />
      {item(<span className="legend-line" style={{ borderColor: '#4caf50' }} />, 'Link normal')}
      {item(<span className="legend-line dashed" style={{ borderColor: '#ffeb3b' }} />, 'Link delayed')}
      {item(<span className="legend-line dashed" style={{ borderColor: '#ff9800' }} />, 'Link degraded')}
      {item(<span className="legend-line dotted" style={{ borderColor: '#f44336' }} />, 'Link lost')}
    </div>
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
        shadows
        camera={{ position: [0, 18, 18], fov: 50, near: 0.1, far: 100 }}
        style={{ background: '#0d1117' }}
      >
        <Suspense fallback={null}>
          <Environment />
          <Terrain />
          <Roads />
          <Buildings />
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
            enablePan
            enableZoom
            enableRotate
            maxPolarAngle={Math.PI / 2.2}
            minDistance={5}
            maxDistance={35}
            target={[0, 0, 0]}
          />
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
