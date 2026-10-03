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

export default function TacticalScene() {
  const units = useGameStore((s) => s.units);
  const reports = useGameStore((s) => s.reports);
  const phase = useGameStore((s) => s.phase);
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const setSelectedUnit = useGameStore((s) => s.setSelectedUnit);
  const groundTruth = useGameStore((s) => s.groundTruth);

  // Extract reported contact positions from reports
  const contacts = reports
    .filter((r) => r.reported_position && r.category === 'CONTACT')
    .map((r) => ({
      position: r.reported_position,
      confidence: r.confidence,
      label: r.source_unit,
      isGroundTruth: false,
    }));

  // Show ground truth in REVEAL and AAR phases
  const showGroundTruth = phase === 'REVEAL' || phase === 'AAR';
  const hostileMarkers = showGroundTruth && groundTruth?.hostile_units
    ? groundTruth.hostile_units.map((h) => ({
        position: h.position,
        confidence: 1,
        label: h.name,
        isGroundTruth: true,
      }))
    : [];

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
    </div>
  );
}
