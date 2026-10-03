/* ── Contact Markers — unknown / hostile markers on the map ── */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { getTerrainHeight } from '../../utils/terrainUtils';
import { useGameStore } from '../../stores/gameStore';

export default function ContactMarker({ position, confidence, label, isGroundTruth }) {
  const scenarioType = useGameStore((s) => s.scenarioState?.config?.scenario_type || 'URBAN');
  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.5;
      if (!isGroundTruth) {
        // Pulse based on confidence (lower confidence = faster pulse)
        const speed = 2 + (1 - confidence) * 4;
        ref.current.scale.setScalar(0.8 + Math.sin(clock.getElapsedTime() * speed) * 0.2);
      }
    }
  });

  const color = isGroundTruth ? '#f44336' : '#ff9800';
  const opacity = isGroundTruth ? 0.9 : 0.3 + confidence * 0.5;

  const terrainY = getTerrainHeight(position.x, -position.z, scenarioType);

  return (
    <group position={[position.x, terrainY, position.z]}>
      <mesh ref={ref} position={[0, 0.8, 0]} castShadow>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color={color}
          flatShading
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={opacity}
          wireframe={!isGroundTruth}
        />
      </mesh>

      {/* Confidence ring */}
      {!isGroundTruth && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[
            0.5 + (1 - confidence) * 2,
            0.6 + (1 - confidence) * 2,
            16
          ]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2 + confidence * 0.3}
            side={2}
          />
        </mesh>
      )}

      <Html position={[0, 1.5, 0]} center distanceFactor={15} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: isGroundTruth ? 'rgba(244,67,54,0.8)' : 'rgba(255,152,0,0.7)',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '10px',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap',
        }}>
          {isGroundTruth ? '⚠ ACTUAL' : `? ${(confidence * 100).toFixed(0)}%`}
          {label && <div style={{ fontSize: '8px' }}>{label}</div>}
        </div>
      </Html>
    </group>
  );
}
