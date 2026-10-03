/* ── Commander's Assessment — belief pins on the map ───────── */
import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { getTerrainHeight } from '../../utils/terrainUtils';

const PIN_STYLES = {
  you: { color: '#4dd0e1', label: 'YOUR ESTIMATE' },
  evidence: { color: '#bc8cff', label: 'EVIDENCE SAID' },
};

/** A map pin with an uncertainty ring: lower confidence = wider ring. */
export function BeliefPin({ position, confidence, kind = 'you' }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const style = PIN_STYLES[kind];
  const y = getTerrainHeight(position.x, -position.z, scenarioType);
  const radius = confidence != null ? 0.6 + (1 - confidence) * 4 : 0.8;

  return (
    <group position={[position.x, y, position.z]}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 6]} />
        <meshBasicMaterial color={style.color} />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshBasicMaterial color={style.color} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[radius - 0.08, radius, 40]} />
        <meshBasicMaterial color={style.color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[radius, 40]} />
        <meshBasicMaterial color={style.color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 2.5, 0]} center distanceFactor={15} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(13,17,23,0.85)',
          border: `1px solid ${style.color}`,
          color: style.color,
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '10px',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap',
        }}>
          {style.label}{confidence != null ? ` ${Math.round(confidence * 100)}%` : ''}
        </div>
      </Html>
    </group>
  );
}

/** Live: click the ground to place the belief pin during the DECISION phase. */
export function AssessmentPicker() {
  const phase = useGameStore((s) => s.phase);
  const isPaused = useGameStore((s) => s.isPaused);
  const assessment = useGameStore((s) => s.assessment);
  const confidence = useGameStore((s) => s.assessConfidence);
  const setAssessment = useGameStore((s) => s.setAssessment);

  if (phase !== 'DECISION') return null;

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.3, 0]}
        onClick={(e) => {
          if (isPaused) return;
          e.stopPropagation();
          setAssessment({ x: +e.point.x.toFixed(2), z: +e.point.z.toFixed(2) });
        }}
        onPointerOver={() => { document.body.style.cursor = 'crosshair'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {assessment && <BeliefPin position={assessment} confidence={confidence} kind="you" />}
    </>
  );
}
